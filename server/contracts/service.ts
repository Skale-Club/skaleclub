import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type {
  ContractDraft,
  ContractEvent,
  ContractView,
  ContractReceipt,
  SigningGate,
} from "#shared/contracts.js";
import { signingConsent } from "#shared/contracts.js";
import type { ContractRow } from "#shared/schema/contracts.js";
import type { ContractStore, ContractTransaction } from "./store.js";

export class ContractError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface RequestEvidence {
  ipAddress: string;
  userAgent: string;
}
export type ContractMailer = (
  to: string[],
  subject: string,
  body: string,
) => Promise<boolean>;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
// Postgres jsonb does not preserve object key order. Hash a canonical encoding
// so loading the same snapshot from the database never changes its digest.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export class ContractService {
  constructor(
    public store: ContractStore,
    private options: {
      secret: () => string;
      mail: ContractMailer;
      now?: () => Date;
    },
  ) {}
  private now() {
    return (this.options.now?.() ?? new Date()).toISOString();
  }
  private mac(value: string) {
    const secret = this.options.secret();
    if (secret.length < 32)
      throw new ContractError(
        503,
        "Contract signing requires a persistent signing secret of at least 32 characters.",
      );
    return createHmac("sha256", secret).update(value).digest("hex");
  }
  private event(
    id: string,
    type: string,
    actor: string,
    evidence?: RequestEvidence,
  ): ContractEvent {
    return {
      id: randomUUID(),
      contractId: id,
      type,
      actor,
      occurredAt: this.now(),
      ipAddress: evidence?.ipAddress ?? null,
      userAgent: evidence?.userAgent ?? null,
    };
  }
  private async change<T>(
    id: string,
    work: (
      tx: ContractTransaction,
    ) => T | ContractError | Promise<T | ContractError>,
  ): Promise<T> {
    // A failed OTP attempt must COMMIT its counter/audit event, then return an error.
    const result = await this.store.transact(id, work);
    if (result === undefined)
      throw new ContractError(404, "Contract not found.");
    if (result instanceof ContractError) throw result;
    return result;
  }
  private active(row: ContractRow): ContractError | null {
    if (row.status === "draft" || row.status === "voided")
      return new ContractError(410, "This contract is unavailable.");
    if (
      row.status === "sent" &&
      (!row.expiresAt || Date.parse(row.expiresAt) <= Date.parse(this.now()))
    )
      return new ContractError(
        410,
        "This signing link has expired. Contact the company.",
      );
    return null;
  }
  private linkToken(id: string) {
    return this.mac(`contract-link:v1:${id}`);
  }
  private checkLink(row: ContractRow, token: string) {
    if (!equal(this.linkToken(row.id), token))
      throw new ContractError(404, "Contract not found.");
  }
  private checkAccess(row: ContractRow, access: string) {
    return (
      row.accessTokenHash &&
      equal(row.accessTokenHash, hash(access)) &&
      row.accessExpiresAt &&
      Date.parse(row.accessExpiresAt) > Date.parse(this.now())
    );
  }
  view(row: ContractRow, admin = false): ContractView {
    const {
      createdBy,
      challenge,
      accessTokenHash,
      accessExpiresAt,
      emailVerifiedAt,
      ...view
    } = row;
    return {
      ...view,
      ...(admin && row.status !== "draft"
        ? { sharePath: `/contracts/${row.id}#${this.linkToken(row.id)}` }
        : {}),
    };
  }
  async create(draft: ContractDraft, actor: string, evidence: RequestEvidence) {
    const now = this.now();
    const row: ContractRow = {
      ...draft,
      id: randomUUID(),
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
      version: 1,
      status: "draft",
      sentAt: null,
      expiresAt: null,
      signedAt: null,
      snapshot: null,
      documentHash: null,
      receipt: null,
      challenge: null,
      accessTokenHash: null,
      accessExpiresAt: null,
      emailVerifiedAt: null,
    };
    await this.store.create(
      row,
      this.event(row.id, "created", actor, evidence),
    );
    return this.view(row, true);
  }
  async update(
    id: string,
    draft: ContractDraft,
    version: number,
    actor: string,
    evidence: RequestEvidence,
  ) {
    return this.change(id, ({ row, events }) => {
      if (row.status !== "draft")
        return new ContractError(
          409,
          "Sent contracts cannot be edited. Create a new contract instead.",
        );
      if (row.version !== version)
        return new ContractError(
          409,
          "This draft was changed elsewhere. Reload it before saving.",
        );
      Object.assign(row, draft, { version: row.version + 1 });
      events.push(this.event(id, "draft_updated", actor, evidence));
      return this.view(row, true);
    });
  }
  async issue(
    id: string,
    version: number,
    actor: string,
    evidence: RequestEvidence,
  ) {
    return this.change(id, ({ row, events }) => {
      if (row.status !== "draft" || row.version !== version)
        return new ContractError(409, "Reload this contract before sending.");
      this.linkToken(id); // Fail before freezing a document if signing is not configured.
      row.sentAt = this.now();
      row.expiresAt = new Date(
        Date.parse(row.sentAt) + row.expiresInDays * 86_400_000,
      ).toISOString();
      row.snapshot = {
        schemaVersion: 1,
        id,
        title: row.title,
        body: row.body,
        companyName: row.companyName,
        companyEmail: row.companyEmail,
        signerName: row.signerName,
        signerEmail: row.signerEmail,
        language: row.language,
        sentAt: row.sentAt,
        expiresAt: row.expiresAt,
        consent: signingConsent[row.language],
      };
      row.documentHash = hash(canonicalJson(row.snapshot));
      row.status = "sent";
      events.push(this.event(id, "issued", actor, evidence));
      return this.view(row, true);
    });
  }
  async void(id: string, actor: string, evidence: RequestEvidence) {
    return this.change(id, ({ row, events }) => {
      if (row.status !== "sent")
        return new ContractError(
          409,
          "Only an unsigned, sent contract can be voided.",
        );
      row.status = "voided";
      row.challenge = null;
      row.accessTokenHash = null;
      events.push(this.event(id, "voided", actor, evidence));
      return this.view(row, true);
    });
  }
  async invitation(
    id: string,
    origin: string,
    actor: string,
    evidence: RequestEvidence,
  ) {
    const row = await this.store.get(id);
    if (!row) throw new ContractError(404, "Contract not found.");
    const unavailable = this.active(row);
    if (unavailable) throw unavailable;
    if (row.status !== "sent")
      throw new ContractError(409, "This contract has already been signed.");
    const pt = row.language === "pt";
    const delivered = await this.options.mail(
      [row.signerEmail],
      `${row.companyName}: ${row.title}`,
      pt
        ? `${row.signerName},\n\n${row.companyName} enviou um contrato para sua revisão e assinatura:\n${row.title}\n\n${origin}/contracts/${id}#${this.linkToken(id)}\n\nVocê precisará confirmar seu e-mail com um código. O link expira em ${row.expiresAt}.\nDúvidas ou assinatura em papel: ${row.companyEmail}`
        : `${row.signerName},\n\n${row.companyName} sent a contract for your review and signature:\n${row.title}\n\n${origin}/contracts/${id}#${this.linkToken(id)}\n\nYou will confirm your email with a code. This link expires on ${row.expiresAt}.\nQuestions or paper signing: ${row.companyEmail}`,
    );
    await this.change(id, ({ events }) => {
      events.push(
        this.event(
          id,
          delivered ? "invitation_sent" : "invitation_failed",
          actor,
          evidence,
        ),
      );
      return true;
    });
    return { delivered };
  }
  async gate(id: string, token: string): Promise<SigningGate> {
    const row = await this.store.get(id);
    if (!row) throw new ContractError(404, "Contract not found.");
    this.checkLink(row, token);
    if (row.status === "draft")
      throw new ContractError(404, "Contract not found.");
    const [local, domain] = row.signerEmail.split("@");
    return {
      companyName: row.companyName,
      maskedEmail: `${local[0]}***@${domain}`,
      language: row.language,
      status:
        row.status === "sent" &&
        row.expiresAt &&
        Date.parse(row.expiresAt) <= Date.parse(this.now())
          ? "expired"
          : row.status,
    };
  }
  async requestCode(id: string, token: string, evidence: RequestEvidence) {
    const challengeToken = randomBytes(32).toString("hex");
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const target = await this.change(id, ({ row, events }) => {
      this.checkLink(row, token);
      const unavailable = this.active(row);
      if (unavailable) return unavailable;
      const now = this.now();
      const previous = row.challenge;
      if (previous && Date.parse(now) - Date.parse(previous.sentAt) < 60_000)
        return new ContractError(
          429,
          "Wait 60 seconds before requesting another code.",
        );
      const sameWindow =
        previous &&
        Date.parse(now) - Date.parse(previous.windowStart) < 3_600_000;
      if (sameWindow && previous.requests >= 5)
        return new ContractError(
          429,
          "Too many verification requests. Try again in one hour.",
        );
      row.challenge = {
        tokenHash: hash(challengeToken),
        codeHash: this.mac(`otp:${id}:${challengeToken}:${code}`),
        attempts: 0,
        sentAt: now,
        expiresAt: new Date(Date.parse(now) + 600_000).toISOString(),
        windowStart: sameWindow ? previous.windowStart : now,
        requests: sameWindow ? previous.requests + 1 : 1,
      };
      events.push(
        this.event(id, "verification_requested", row.signerEmail, evidence),
      );
      return {
        email: row.signerEmail,
        company: row.companyName,
        language: row.language,
      };
    });
    const delivered = await this.options.mail(
      [target.email],
      target.language === "pt"
        ? "Seu código para assinatura"
        : "Your signing verification code",
      target.language === "pt"
        ? `Seu código é ${code}. Expira em 10 minutos. Use-o apenas no contrato de ${target.company}. Se você não solicitou, ignore este e-mail.`
        : `Your code is ${code}. It expires in 10 minutes. Only use it on the contract from ${target.company}. If you did not request it, ignore this email.`,
    );
    if (!delivered) {
      await this.change(id, ({ row, events }) => {
        if (row.challenge?.tokenHash === hash(challengeToken))
          row.challenge.codeHash = "disabled";
        events.push(
          this.event(
            id,
            "verification_delivery_failed",
            target.email,
            evidence,
          ),
        );
        return true;
      });
      throw new ContractError(
        503,
        "The verification email could not be sent. Contact the company or try again later.",
      );
    }
    return { challengeToken };
  }
  async verify(
    id: string,
    token: string,
    challengeToken: string,
    code: string,
    evidence: RequestEvidence,
  ) {
    return this.change(id, ({ row, events }) => {
      this.checkLink(row, token);
      const unavailable = this.active(row);
      if (unavailable) return unavailable;
      const c = row.challenge;
      if (
        !c ||
        !equal(c.tokenHash, hash(challengeToken)) ||
        Date.parse(c.expiresAt) <= Date.parse(this.now()) ||
        c.attempts >= 5
      )
        return new ContractError(
          401,
          "Code expired or unavailable. Request a new code.",
        );
      c.attempts++;
      if (!equal(c.codeHash, this.mac(`otp:${id}:${challengeToken}:${code}`))) {
        events.push(
          this.event(id, "verification_failed", row.signerEmail, evidence),
        );
        return new ContractError(401, "Incorrect verification code.");
      }
      const accessToken = randomBytes(32).toString("hex");
      row.accessTokenHash = hash(accessToken);
      row.accessExpiresAt = new Date(
        Date.parse(this.now()) + 86_400_000,
      ).toISOString();
      row.emailVerifiedAt = this.now();
      c.codeHash = "used";
      c.attempts = 5;
      events.push(this.event(id, "email_verified", row.signerEmail, evidence));
      return { accessToken, contract: this.view(row) };
    });
  }
  async document(id: string, token: string, access: string) {
    const row = await this.store.get(id);
    if (!row) throw new ContractError(404, "Contract not found.");
    this.checkLink(row, token);
    const unavailable = this.active(row);
    if (unavailable) throw unavailable;
    if (!this.checkAccess(row, access))
      throw new ContractError(
        401,
        "Confirm your email to access this document.",
      );
    return this.view(row);
  }
  async sign(
    id: string,
    token: string,
    access: string,
    typedName: string,
    documentHash: string,
    evidence: RequestEvidence,
  ) {
    return this.change(id, ({ row, events }) => {
      this.checkLink(row, token);
      const unavailable = this.active(row);
      if (unavailable) return unavailable;
      if (!this.checkAccess(row, access) || !row.emailVerifiedAt)
        return new ContractError(401, "Confirm your email before signing.");
      if (row.status !== "sent")
        return new ContractError(409, "This contract has already been signed.");
      if (
        !row.snapshot ||
        row.documentHash !== documentHash ||
        hash(canonicalJson(row.snapshot)) !== documentHash
      )
        return new ContractError(
          409,
          "Reload and review the current document before signing.",
        );
      const normalize = (name: string) =>
        name
          .normalize("NFKC")
          .trim()
          .replace(/\s+/g, " ")
          .toLocaleLowerCase("en-US");
      if (normalize(typedName) !== normalize(row.signerName))
        return new ContractError(
          400,
          "Enter the full name specified in this contract.",
        );
      const signedAt = this.now();
      const unsigned = {
        schemaVersion: 1 as const,
        document: row.snapshot,
        documentHash,
        signature: {
          typedName: typedName.trim(),
          email: row.signerEmail,
          emailVerifiedAt: row.emailVerifiedAt,
          signedAt,
          ipAddress: evidence.ipAddress,
          userAgent: evidence.userAgent,
          consent: row.snapshot.consent,
          method: "email_otp_typed_name" as const,
        },
      };
      row.receipt = {
        ...unsigned,
        seal: this.mac(`receipt:v1:${canonicalJson(unsigned)}`),
      };
      row.signedAt = signedAt;
      row.status = "signed";
      events.push(this.event(id, "signed", row.signerEmail, evidence));
      return this.view(row);
    });
  }
  async sendCopy(receipt: ContractReceipt) {
    const d = receipt.document,
      s = receipt.signature;
    // Sending is separate from the signature transaction: a delivery failure never loses a signed record.
    return this.options.mail(
      [d.signerEmail, d.companyEmail],
      `${d.companyName}: ${d.title} — signed`,
      `${d.title}\n\n${d.body}\n\n--- Electronic signature record ---\nContract: ${d.id}\nSigned by: ${s.typedName}\nVerified email: ${s.email}\nEmail verified: ${s.emailVerifiedAt}\nSigned: ${s.signedAt}\nIP: ${s.ipAddress}\nBrowser: ${s.userAgent}\nMethod: ${s.method}\n\nConsent:\n${s.consent}\n\nDocument SHA-256: ${receipt.documentHash}\nRecord seal: ${receipt.seal}\n\nKeep this email as a copy of the signed record. You can also save or print the document through the signing link.`,
    );
  }
  verifyReceipt(receipt: ContractReceipt) {
    const { seal, ...unsigned } = receipt;
    return {
      documentMatches:
        hash(canonicalJson(receipt.document)) === receipt.documentHash,
      sealMatches: equal(
        seal,
        this.mac(`receipt:v1:${canonicalJson(unsigned)}`),
      ),
    };
  }
  async notifyCopy(id: string) {
    const row = await this.store.get(id);
    if (!row?.receipt) throw new ContractError(404, "Signed record not found.");
    const delivered = await this.sendCopy(row.receipt).catch(() => false);
    await this.change(id, ({ events }) => {
      events.push(
        this.event(
          id,
          delivered ? "signed_copy_sent" : "signed_copy_failed",
          "system",
        ),
      );
      return true;
    });
    return { delivered };
  }
}
