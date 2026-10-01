// Tiny self-contained HTML pages for smart tags that are not live. No SPA, no
// JavaScript, no external assets: these must render instantly on any phone and
// never show customer data.

export type TagPageKind = "inactive" | "unavailable" | "not_found";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const COPY: Record<TagPageKind, { title: string; body: string }> = {
  inactive: {
    title: "This smart tag has not been activated yet.",
    body: "It will start working as soon as it is set up. Please check back later.",
  },
  unavailable: {
    title: "This smart tag is not available.",
    body: "The link on this tag is currently inactive.",
  },
  not_found: {
    title: "Smart tag not found.",
    body: "This code does not match any Skale Club smart tag.",
  },
};

export function renderTagPage(kind: TagPageKind, opts: { code?: string; configureUrl?: string } = {}): string {
  const { title, body } = COPY[kind];
  const code = opts.code ? `<p class="code">Tag ${escapeHtml(opts.code)}</p>` : "";
  const configure = opts.configureUrl
    ? `<a class="btn" href="${escapeHtml(opts.configureUrl)}">Configure this tag</a>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)} | Skale Club</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #0b0d12; color: #f5f6f8; }
  main { max-width: 22rem; padding: 2rem 1.5rem; text-align: center; }
  .brand { font-weight: 700; letter-spacing: .02em; color: #9aa3b2; font-size: .85rem; text-transform: uppercase; }
  h1 { font-size: 1.35rem; line-height: 1.3; margin: 1rem 0 .5rem; }
  p { color: #c3c8d2; line-height: 1.5; margin: 0; }
  .code { margin-top: 1rem; font-family: ui-monospace, monospace; color: #9aa3b2; font-size: .85rem; }
  .btn { display: inline-block; margin-top: 1.5rem; padding: .75rem 1.25rem; border-radius: .6rem; background: #3b82f6; color: #fff; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
<main>
  <div class="brand">Skale Club</div>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(body)}</p>
  ${code}
  ${configure}
</main>
</body>
</html>`;
}
