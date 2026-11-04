import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { contractDraftSchema } from "#shared/contracts.js";
import {
  ContractError,
  ContractService,
  type RequestEvidence,
} from "../contracts/service.js";
import { postgresContractStore } from "../contracts/store.js";
import { renderContractRecord } from "../contracts/record.js";
import { storage } from "../storage.js";
import { sendEmail } from "../integrations/resend.js";
import { requireAdmin, sendError } from "./_shared.js";
import { rateLimitMiddleware } from "../lib/rateLimit.js";
import { canonicalOrigin } from "../seo/inject.js";

export const contractService = new ContractService(postgresContractStore, {
  secret: () =>
    process.env.CONTRACT_SIGNING_SECRET || process.env.SESSION_SECRET || "",
  async mail(to, subject, body) {
    try {
      const settings = await storage.getResendSettings();
      if (!settings?.enabled || !settings.apiKey || !settings.fromEmail)
        return false;
      return (
        await sendEmail(
          {
            apiKey: settings.apiKey,
            fromName: settings.fromName,
            fromEmail: settings.fromEmail,
          },
          to,
          subject,
          body,
        )
      ).success;
    } catch {
      return false;
    }
  },
});

const idSchema = z.string().uuid();
const versionSchema = z
  .object({ version: z.number().int().positive() })
  .strict();
const evidence = (req: Request): RequestEvidence => ({
  ipAddress: req.ip || "unknown",
  userAgent: (req.get("user-agent") || "unknown").slice(0, 1000),
});
const bearer = (req: Request) =>
  (req.get("authorization") || "").replace(/^Bearer /, "");
const access = (req: Request) => req.get("x-signing-access") || "";
const actor = (req: Request) =>
  String((req.session as unknown as { userId: string }).userId);

export function registerContractRoutes(
  app: Express,
  service = contractService,
  admin: RequestHandler = requireAdmin,
) {
  app.use(["/api/contracts", "/api/signing"], (_req, res, next) => {
    res.set({
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    });
    next();
  });
  // The secret stays in the URL fragment and request headers, never in access logs.
  app.use("/contracts", (_req, res, next) => {
    res.set({
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    });
    next();
  });
  const handle =
    (
      fn: (req: Request, res: import("express").Response) => Promise<unknown>,
    ): RequestHandler =>
    async (req, res) => {
      try {
        await fn(req, res);
      } catch (error) {
        if (error instanceof ContractError) {
          res.status(error.status).json({ message: error.message });
          return;
        }
        sendError(res, error, "Unable to process this contract.");
      }
    };
  const limited = rateLimitMiddleware({
    limit: 15,
    windowMs: 60 * 60_000,
    keyFn: (req) => `sign-code:${req.ip}`,
  });
  const publicLimit = rateLimitMiddleware({
    limit: 120,
    windowMs: 60_000,
    keyFn: (req) => `sign-read:${req.ip}`,
  });
  const sendLimit = rateLimitMiddleware({
    limit: 15,
    windowMs: 60_000,
    keyFn: (req) => `contract-send:${actor(req)}`,
  });
  const download = (
    res: import("express").Response,
    contract: import("#shared/contracts.js").ContractView,
  ) => {
    res.set(
      "Content-Disposition",
      `attachment; filename="contract-${contract.id}.html"`,
    );
    res.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox",
    );
    res.type("html").send(renderContractRecord(contract));
  };

  app.get(
    "/api/contracts",
    admin,
    handle(async (req, res) => {
      const pagination = z
        .object({
          limit: z.coerce.number().int().min(1).max(100).default(25),
          offset: z.coerce.number().int().min(0).default(0),
        })
        .parse(req.query);
      const result = await service.store.list(
        pagination.limit,
        pagination.offset,
      );
      res.json({
        data: result.data.map((row) => {
          const { body, snapshot, receipt, ...summary } = service.view(row);
          return summary;
        }),
        total: result.total,
      });
    }),
  );
  app.post(
    "/api/contracts",
    admin,
    handle(async (req, res) => {
      res
        .status(201)
        .json(
          await service.create(
            contractDraftSchema.parse(req.body),
            actor(req),
            evidence(req),
          ),
        );
    }),
  );
  app.get(
    "/api/contracts/:id",
    admin,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const row = await service.store.get(id);
      if (!row) throw new ContractError(404, "Contract not found.");
      res.json({
        contract: service.view(row, true),
        events: await service.store.events(id),
      });
    }),
  );
  app.put(
    "/api/contracts/:id",
    admin,
    handle(async (req, res) => {
      const { version, ...draft } = contractDraftSchema
        .extend({ version: z.number().int().positive() })
        .parse(req.body);
      res.json(
        await service.update(
          idSchema.parse(req.params.id),
          draft,
          version,
          actor(req),
          evidence(req),
        ),
      );
    }),
  );
  app.post(
    "/api/contracts/:id/issue",
    admin,
    sendLimit,
    handle(async (req, res) => {
      const { version } = versionSchema.parse(req.body);
      res.json(
        await service.issue(
          idSchema.parse(req.params.id),
          version,
          actor(req),
          evidence(req),
        ),
      );
    }),
  );
  app.post(
    "/api/contracts/:id/invite",
    admin,
    sendLimit,
    handle(async (req, res) => {
      res.json(
        await service.invitation(
          idSchema.parse(req.params.id),
          canonicalOrigin(),
          actor(req),
          evidence(req),
        ),
      );
    }),
  );
  app.post(
    "/api/contracts/:id/void",
    admin,
    handle(async (req, res) => {
      res.json(
        await service.void(
          idSchema.parse(req.params.id),
          actor(req),
          evidence(req),
        ),
      );
    }),
  );
  app.post(
    "/api/contracts/:id/copy",
    admin,
    sendLimit,
    handle(async (req, res) => {
      res.json(await service.notifyCopy(idSchema.parse(req.params.id)));
    }),
  );
  app.get(
    "/api/contracts/:id/record",
    admin,
    handle(async (req, res) => {
      const row = await service.store.get(idSchema.parse(req.params.id));
      if (!row || !row.snapshot)
        throw new ContractError(404, "Contract record not found.");
      download(res, service.view(row));
    }),
  );
  app.get(
    "/api/contracts/:id/evidence",
    admin,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const row = await service.store.get(id);
      if (!row?.receipt)
        throw new ContractError(404, "Signed record not found.");
      res.set(
        "Content-Disposition",
        `attachment; filename="contract-${id}-evidence.json"`,
      );
      res.json({
        integrity: service.verifyReceipt(row.receipt),
        receipt: row.receipt,
        events: await service.store.events(id),
      });
    }),
  );
  app.get(
    "/api/signing/:id",
    publicLimit,
    handle(async (req, res) => {
      res.json(await service.gate(idSchema.parse(req.params.id), bearer(req)));
    }),
  );
  app.post(
    "/api/signing/:id/code",
    limited,
    handle(async (req, res) => {
      res.json(
        await service.requestCode(
          idSchema.parse(req.params.id),
          bearer(req),
          evidence(req),
        ),
      );
    }),
  );
  app.post(
    "/api/signing/:id/verify",
    publicLimit,
    handle(async (req, res) => {
      const { challengeToken, code } = z
        .object({
          challengeToken: z.string().regex(/^[a-f0-9]{64}$/),
          code: z.string().regex(/^\d{6}$/),
        })
        .strict()
        .parse(req.body);
      res.json(
        await service.verify(
          idSchema.parse(req.params.id),
          bearer(req),
          challengeToken,
          code,
          evidence(req),
        ),
      );
    }),
  );
  app.get(
    "/api/signing/:id/document",
    publicLimit,
    handle(async (req, res) => {
      res.json(
        await service.document(
          idSchema.parse(req.params.id),
          bearer(req),
          access(req),
        ),
      );
    }),
  );
  app.get(
    "/api/signing/:id/record",
    publicLimit,
    handle(async (req, res) => {
      download(
        res,
        await service.document(
          idSchema.parse(req.params.id),
          bearer(req),
          access(req),
        ),
      );
    }),
  );
  app.post(
    "/api/signing/:id/sign",
    publicLimit,
    handle(async (req, res) => {
      const input = z
        .object({
          typedName: z.string().trim().min(2).max(200),
          documentHash: z.string().regex(/^[a-f0-9]{64}$/),
          consent: z.literal(true),
        })
        .strict()
        .parse(req.body);
      const contract = await service.sign(
        idSchema.parse(req.params.id),
        bearer(req),
        access(req),
        input.typedName,
        input.documentHash,
        evidence(req),
      );
      const copyDelivered = (
        await service
          .notifyCopy(contract.id)
          .catch(() => ({ delivered: false }))
      ).delivered;
      res.json({ contract, copyDelivered });
    }),
  );
}
