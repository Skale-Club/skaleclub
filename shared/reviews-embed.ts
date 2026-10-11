import type { z } from "zod";
import { reviewsXphereConfigSchema } from "./section-definitions.js";

export type ReviewsXphereConfig = z.infer<typeof reviewsXphereConfigSchema>;

export type SafeLegacyReviewsEmbed =
  | { type: "xphere"; config: ReviewsXphereConfig }
  | { type: "iframe"; url: string }
  | { type: "invalid"; reason: string };

function trustedIframeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "reputationhub.site" || host.endsWith(".reputationhub.site")) return url.toString();
    if (host === "xphere.app" || host.endsWith(".xphere.app")) return url.toString();
  } catch {
    // Invalid URLs are reported by parseLegacyReviewsEmbed.
  }
  return null;
}

function attr(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`${escaped}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
}

function boolAttr(value: string | undefined, falseValue = "0") {
  return value === undefined ? undefined : value !== falseValue;
}

function numberAttr(value: string | undefined) {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function xphereFromParams(url: URL): ReviewsXphereConfig | null {
  const candidate = {
    token: url.searchParams.get("token") ?? "",
    layout: url.searchParams.get("layout") ?? undefined,
    theme: url.searchParams.get("theme") ?? undefined,
    minRating: numberAttr(url.searchParams.get("min_rating") ?? undefined),
    sort: url.searchParams.get("sort") ?? undefined,
    limit: numberAttr(url.searchParams.get("limit") ?? undefined),
    showHero: url.searchParams.has("hero") ? url.searchParams.get("hero") !== "0" : undefined,
    heroStyle: url.searchParams.get("hero_style") ?? undefined,
    cardShape: url.searchParams.get("shape") ?? undefined,
    equalHeight: url.searchParams.has("eqh") ? url.searchParams.get("eqh") !== "0" : undefined,
    footerCta: url.searchParams.has("cta") ? url.searchParams.get("cta") === "1" : undefined,
  };
  const parsed = reviewsXphereConfigSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Converts old CMS snippets without ever mounting their HTML or scripts. */
export function parseLegacyReviewsEmbed(raw: string): SafeLegacyReviewsEmbed {
  const value = raw.trim();
  if (!value) return { type: "invalid", reason: "Empty review embed" };

  if (/^https:\/\//i.test(value)) {
    const safeUrl = trustedIframeUrl(value);
    if (!safeUrl) return { type: "invalid", reason: "Review iframe host is not allowlisted" };
    const url = new URL(safeUrl);
    const xphere = xphereFromParams(url);
    return xphere ? { type: "xphere", config: xphere } : { type: "iframe", url: safeUrl };
  }

  const token = attr(value, "data-token");
  const scriptSrc = attr(value, "src");
  if (token && scriptSrc) {
    const safeScript = trustedIframeUrl(scriptSrc);
    if (safeScript && new URL(safeScript).hostname.endsWith("xphere.app")) {
      const candidate = {
        token,
        layout: attr(value, "data-layout"),
        theme: attr(value, "data-theme"),
        minRating: numberAttr(attr(value, "data-min-rating")),
        sort: attr(value, "data-sort"),
        limit: numberAttr(attr(value, "data-limit")),
        showHero: boolAttr(attr(value, "data-hero")),
        heroStyle: attr(value, "data-hero-style"),
        cardShape: attr(value, "data-shape"),
        equalHeight: boolAttr(attr(value, "data-equal-height")),
        footerCta: attr(value, "data-footer-cta") === undefined ? undefined : attr(value, "data-footer-cta") === "1",
      };
      const parsed = reviewsXphereConfigSchema.safeParse(candidate);
      if (parsed.success) return { type: "xphere", config: parsed.data };
      return {
        type: "invalid",
        reason: `Invalid Xphere widget configuration: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`,
      };
    }
  }

  const iframeSrc = value.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  if (iframeSrc) {
    const safeUrl = trustedIframeUrl(iframeSrc);
    if (safeUrl) return { type: "iframe", url: safeUrl };
  }

  return { type: "invalid", reason: "Legacy review embed is not an allowlisted Xphere or ReputationHub widget" };
}
