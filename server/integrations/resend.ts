type ResendResult = { success: boolean; message?: string };

export type ResendConfig = {
  apiKey: string;
  fromName?: string | null;
  fromEmail: string;
};

function buildFrom(config: ResendConfig): string {
  const name = config.fromName?.trim();
  return name ? `${name} <${config.fromEmail}>` : config.fromEmail;
}

export async function sendEmail(
  config: ResendConfig,
  to: string[],
  subject: string,
  body: string,
): Promise<ResendResult> {
  try {
    const recipients = to.map((e) => e.trim()).filter(Boolean);
    if (!recipients.length) {
      return { success: false, message: "No recipient emails configured" };
    }

    const { Resend } = await import("resend");
    const resend = new Resend(config.apiKey);

    const html = body
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
