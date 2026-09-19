// Cloudflare Turnstile server-side verification helper.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//
// Tokens are SINGLE-USE: validating a token here consumes it. The same token
// cannot be validated again by Supabase or any other party — keep verification
// in one place per token.

const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerifyResult {
  success: boolean;
  errorCodes?: string[];
  hostname?: string;
}

/**
 * Verify a Cloudflare Turnstile token against the siteverify endpoint.
 * Returns `{ success: true }` on a valid token; otherwise `{ success: false, errorCodes }`.
 *
 * If `CLOUDFLARE_TURNSTILE_SECRET_KEY` is not set:
 *   - In production (`NODE_ENV === "production"`), verification FAILS CLOSED — returns
 *     `{ success: false, errorCodes: ["missing-secret"] }` so the captcha can never be
 *     silently disabled by a missing/misconfigured secret.
 *   - Otherwise (dev/test), returns `{ success: true }` for local development convenience.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  // No secret configured.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // Fail closed in production: never silently disable captcha verification.
      return { success: false, errorCodes: ["missing-secret"] };
    }
    // Dev convenience: skip verification when no secret is configured.
    return { success: true };
  }

  if (!token) {
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
      hostname?: string;
    };
    return {
      success: !!data.success,
      errorCodes: data["error-codes"],
      hostname: data.hostname,
    };
  } catch (err) {
    return {
      success: false,
      errorCodes: ["network-error"],
    };
  }
}

/**
 * Client IP for rate limiting, from Express.
 *
 * This used to read `x-forwarded-for` and take the LEFTMOST entry. Behind
 * Traefik the proxy APPENDS the real client IP, so the leftmost entry is
 * whatever the caller put there — any client could rotate a fake
 * `X-Forwarded-For` per request and get a fresh rate-limit bucket every time,
 * which made every limiter keyed on this function decorative. The access-code
 * check on gated estimates was the worst of them: 10 guesses per 5 minutes
 * became unlimited.
 *
 * `app.set("trust proxy", 1)` is configured (see server/auth/supabaseAuth.ts),
 * so `req.ip` already resolves the correct hop and cannot be spoofed past the
 * configured trust depth. Use it, and never parse the header by hand again.
 */
export function getClientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}): string | undefined {
  return req.ip;
}
