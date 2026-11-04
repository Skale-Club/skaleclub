// Production UI + real contract routes; disposable in-memory records and email outbox.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import express from "express";
import { chromium, firefox, webkit, type BrowserType } from "playwright";
import { createContractsHarness } from "../server/routes/__tests__/helpers/contractsHarness.js";

const engines: Record<string, BrowserType> = { chromium, firefox, webkit };
const dist = path.resolve("dist/public");
for (const engine of (process.env.E2E_BROWSERS || "chromium").split(",")) {
  test(
    `contracts: admin creates and sends, customer signs on phone, signed copy is retained (${engine})`,
    { timeout: 120_000 },
    async () => {
      const h = createContractsHarness({ alwaysAdmin: true });
      h.app.get("/api/admin/session", (_req, res) =>
        res.json({
          isAdmin: true,
          email: "admin@example.com",
          firstName: "Admin",
          lastName: "",
        }),
      );
      h.app.get("/api/supabase-config", (_req, res) => res.json({}));
      h.app.get("/api/company-settings", (_req, res) =>
        res.json({
          companyName: "Skale Club",
          companyEmail: "company@example.com",
          sectionsOrder: [],
        }),
      );
      h.app.all("/api/*", (_req, res) => res.json([]));
      h.app.use(express.static(dist, { index: false }));
      h.app.get("*", (_req, res) =>
        res.sendFile(path.join(dist, "index.html")),
      );
      const server = h.app.listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const browser = await engines[engine].launch({ headless: true });
      const errors: string[] = [];
      try {
        const admin = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
        });
        admin.on("pageerror", (e) => errors.push(e.message));
        await admin.goto(`${origin}/admin/contracts`);
        await admin.getByTestId("new-contract").click();
        await admin
          .getByTestId("contract-title")
          .fill("Website services agreement");
        await admin
          .getByTestId("contract-company-email")
          .fill("company@example.com");
        await admin.getByTestId("contract-signer-name").fill("Jane Customer");
        await admin
          .getByTestId("contract-signer-email")
          .fill("jane@example.com");
        await admin
          .getByTestId("contract-body")
          .fill(
            "Skale Club will develop a five-page website for Jane Customer.\n\nThe fee is $2,000, paid in two installments. The agreed delivery period is thirty days.\n\nThis is a test agreement, not a production contract.",
          );
        await admin.getByTestId("save-contract").click();
        await admin.getByText("Ready to share?", { exact: true }).waitFor();
        await admin
          .getByRole("button", { name: "Review saved version", exact: true })
          .click();
        await admin.getByTestId("contract-document").waitFor();
        await admin.getByRole("checkbox").check();
        await admin.getByTestId("issue-contract").click();
        const share = admin.getByTestId("contract-share-link");
        await share.waitFor();
        const link = await share.inputValue();
        assert.ok(link.startsWith(`${origin}/contracts/`));
        await admin.getByTestId("invite-contract").click();
        await admin.getByText("Invitation sent.", { exact: true }).waitFor();
        assert.ok(
          h.mail.some(
            (mail) =>
              mail.to.includes("jane@example.com") &&
              mail.body.includes("/contracts/"),
          ),
        );
        const signer = await browser.newPage({
          viewport: { width: 390, height: 844 },
        });
        signer.on("pageerror", (e) => errors.push(e.message));
        const tracking: string[] = [];
        signer.on("request", (req) => {
          if (
            /api\/(attribution|analytics|monitoring)|google-analytics|googletagmanager|facebook\.com/.test(
              req.url(),
            )
          )
            tracking.push(req.url());
        });
        await signer.goto(link);
        await signer.getByTestId("request-code").waitFor();
        assert.equal(await signer.getByTestId("contract-document").count(), 0);
        await signer.getByTestId("request-code").click();
        await signer.getByTestId("signing-code").waitFor();
        const code = h.mail.at(-1)!.body.match(/\b\d{6}\b/)![0];
        await signer.getByTestId("signing-code").fill(code);
        await signer.getByTestId("verify-code").click();
        await signer.getByTestId("contract-document").waitFor();
        assert.equal(
          await signer.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await signer.getByTestId("signature-name").fill("Jane Customer");
        assert.equal(
          await signer.getByTestId("sign-contract").isDisabled(),
          true,
        );
        await signer.getByTestId("signing-consent").check();
        await signer.getByTestId("sign-contract").click();
        await signer.getByTestId("signed-record").waitFor();
        assert.equal(Array.from(h.store.rows.values())[0].status, "signed");
        assert.equal(h.mail.at(-1)!.to.length, 2);
        const downloadPromise = signer.waitForEvent("download");
        await signer.getByTestId("download-record").click();
        const download = await downloadPromise;
        const file = await download.path();
        assert.ok(file);
        assert.match(await readFile(file, "utf8"), /Jane Customer/);
        await signer.emulateMedia({ media: "print" });
        assert.equal(
          await signer.locator(".signing-controls").isVisible(),
          false,
        );
        if (engine === "chromium")
          assert.ok((await signer.pdf()).byteLength > 1000);
        await signer.emulateMedia({ media: "screen" });
        await admin.reload();
        await admin.getByTestId("contract-row").click();
        await admin.getByTestId("signed-record").waitFor();
        assert.equal(await admin.getByTestId("contract-editor").count(), 0);
        const screenshotDir = process.env.E2E_SCREENSHOTS;
        if (screenshotDir) {
          await mkdir(screenshotDir, { recursive: true });
          await signer.screenshot({
            path: path.join(
              screenshotDir,
              `${engine}-contract-signed-mobile.png`,
            ),
            fullPage: true,
          });
          await admin.screenshot({
            path: path.join(
              screenshotDir,
              `${engine}-contracts-admin-desktop.png`,
            ),
            fullPage: true,
          });
        }
        assert.deepEqual(tracking, []);
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  );
}
