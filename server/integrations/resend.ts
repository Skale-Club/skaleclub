type ResendResult = { success: boolean; message?: string };

export type ResendConfig = {
  apiKey: string;
  fromName?: string | null;
  fromEmail: string;
};

export type SendEmailOptions = {
  // Set by callers (e.g. the notifications dispatcher) that have already HTML-escaped
  // untrusted values within `body` themselves and want the rest of the body (e.g.
  // admin-authored template markup) left untouched. Defaults to false, in which case
  // this function HTML-escapes the whole body as a defensive measure for callers that
  // pass raw, potentially-untrusted text straight through.
  alreadyEscaped?: boolean;
};

function buildFrom(config: ResendConfig): string {
  const name = config.fromName?.trim();
  return name ? `${name} <${config.fromEmail}>` : config.fromEmail;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail(
  config: ResendConfig,
  to: string[],
  subject: string,
  body: string,
  options?: SendEmailOptions,
): Promise<ResendResult> {
  try {
    const recipients = to.map((e) => e.trim()).filter(Boolean);
    if (!recipients.length) {
      return { success: false, message: "No recipient emails configured" };
    }

    const { Resend } = await import("resend");
    const resend = new Resend(config.apiKey);

    // The plain-text `text` field below always uses the raw body (text is never HTML-
    // interpreted). Only the `html` field needs escaping, and only when the caller
    // hasn't already escaped untrusted values itself (avoids double-escaping).
    const htmlSource = options?.alreadyEscaped ? body : escapeHtml(body);
    const html = htmlSource
      .split("\n")
      .map((line) => line || "&nbsp;")
      .join("<br>");

    const { error } = await resend.emails.send({
      from: buildFrom(config),
      to: recipients,
      subject: subject || "Notification",
      text: body,
      html,
    });

    if (error) {
      console.error("Resend API error:", error);
      return { success: false, message: error.message ?? "Resend API error" };
    }
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    console.error("Failed to send email:", error);
    return { success: false, message };
  }
}
