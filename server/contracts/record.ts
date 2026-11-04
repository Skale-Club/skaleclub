import type { ContractView } from "#shared/contracts.js";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

// Self-contained copy: no scripts, tracking, external fonts or resources. It can
// be opened offline and printed/saved as PDF without relying on the live site.
export function renderContractRecord(contract: ContractView): string {
  const d = contract.receipt?.document ?? contract.snapshot;
  if (!d) throw new Error("Only issued contracts have a downloadable record");
  const receipt = contract.receipt;
  const s = receipt?.signature;
  const line = (label: string, value: string) =>
    `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`;
  return `<!doctype html><html lang="${d.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${escape(d.title)}</title><style>body{font:16px/1.65 system-ui,sans-serif;color:#172033;background:#fff;max-width:780px;margin:40px auto;padding:0 24px}h1{line-height:1.2}header{border-bottom:2px solid #5173d6;padding-bottom:24px}.body{white-space:pre-wrap;overflow-wrap:anywhere;margin:32px 0}section{border-top:1px solid #ccc;padding-top:20px;break-inside:avoid}dt{font-weight:650;margin-top:10px}dd{margin:0;overflow-wrap:anywhere}.signature{font:italic 32px Georgia,serif}small{color:#555}@media print{body{margin:0;max-width:none;font-size:11pt}section{break-inside:auto}h1{font-size:24pt}@page{margin:18mm}}</style></head><body><header><small>${escape(d.companyName)} · ${escape(d.companyEmail)}</small><h1>${escape(d.title)}</h1><p>${escape(d.signerName)} · ${escape(d.signerEmail)}</p><small>${escape(d.id)} · ${receipt ? "SIGNED / ASSINADO" : "UNSIGNED / NÃO ASSINADO"}</small></header><div class="body">${escape(d.body)}</div><section><h2>${receipt ? "Electronic signature / Assinatura eletrônica" : "Electronic consent / Consentimento eletrônico"}</h2>${s ? `<p class="signature">${escape(s.typedName)}</p><dl>${line("Verified email", s.email)}${line("Email verified at (UTC)", s.emailVerifiedAt)}${line("Signed at (UTC)", s.signedAt)}${line("IP address", s.ipAddress)}${line("Browser", s.userAgent)}${line("Method", s.method)}</dl>` : ""}<p>${escape(d.consent)}</p><dl>${line("Document SHA-256", contract.documentHash ?? "")}${receipt ? line("Record HMAC-SHA-256 seal", receipt.seal) : ""}</dl><small>This record stores the recipient's electronic signature. A company countersignature is not recorded. / Este registro contém a assinatura eletrônica do destinatário. Não registra uma contra-assinatura da empresa.</small></section></body></html>`;
}
