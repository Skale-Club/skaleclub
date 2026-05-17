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
 * If `CLOUDFLARE_TURNSTILE_SECRET_KEY` is not set, returns `{ success: true }` so the
 * verification is effectively disabled — useful for local development without keys.
 * In production set the secret key to actually enforce the captcha.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  // No secret configured → skip verification (dev convenience).
  if (!secret) {
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
 * Best-effort client IP extraction from an Express request. Honors common proxy
 * headers (X-Forwarded-For first hop, X-Real-IP). Falls back to req.ip.
 */
export function getClientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}): string | undefined {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0]?.trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) {
    return realIp;
  }
  return req.ip;
}
