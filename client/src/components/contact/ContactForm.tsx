import { useState } from "react";
import { Send } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EditorialCard, PillButton } from "@/components/editorial";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

const fieldClass = "rounded-none border-ink-700/15 bg-white text-ink placeholder:text-ink-400 focus-visible:ring-2 focus-visible:ring-cta-ink/30 focus-visible:border-cta-ink";
const labelClass = "text-xs font-bold uppercase tracking-[0.16em] text-ink-500";
const consentClass =
  "flex cursor-pointer items-start gap-3 border border-ink-700/10 p-4 font-normal transition-colors hover:bg-paper";

// The EN wording is US A2P/TCPA text (HELP/STOP keywords). PT visitors get a
// neutral version that does not reference US SMS keywords.
const PT_SUBMIT_CONSENT = "Ao enviar, você concorda em receber contato por WhatsApp, e-mail ou telefone sobre sua solicitação. Veja nossa";
const PT_TRANSACTIONAL_CONSENT =
  "Concordo em receber mensagens sobre minha solicitação, como confirmações e atualizações de pedidos ou serviços, por WhatsApp, e-mail ou telefone.";
const PT_MARKETING_CONSENT =
  "Concordo em receber ofertas, novidades e conteúdos promocionais por WhatsApp ou e-mail. Posso cancelar quando quiser.";

export function ContactForm({ companyName }: { companyName: string }) {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: formEmail,
          phone: formPhone,
          subject,
          message,
          smsConsent,
          marketingConsent,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast({
        title: t("Message Sent"),
        description: t("We'll get back to you as soon as possible."),
      });
      setName("");
      setFormEmail("");
      setFormPhone("");
      setSubject("");
      setMessage("");
      setSmsConsent(false);
      setMarketingConsent(false);
    } catch {
      toast({
        title: t("Error"),
        description: t("Something went wrong."),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const linkClass = "underline hover:text-ink transition-colors";
  const pt = language === "pt";

  return (
    <div>
    <EditorialCard tone="light">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="contact-name" className={labelClass}>{t("Full Name")}</label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className={fieldClass}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="contact-email" className={labelClass}>{t("Email Address")}</label>
            <Input
              type="email"
              id="contact-email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="john@example.com"
              className={fieldClass}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-phone" className={labelClass}>{t("Phone Number")}</label>
          <Input
            type="tel"
            id="contact-phone"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className={fieldClass}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-subject" className={labelClass}>{t("Subject")}</label>
          <Input
            id="contact-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("How can we help?")}
            className={fieldClass}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-message" className={labelClass}>{t("Message")}</label>
          <Textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("Tell us more about your needs...")}
            className={`${fieldClass} min-h-[150px]`}
            required
          />
        </div>

        <Label htmlFor="sms-consent" className={consentClass}>
          <Checkbox
            id="sms-consent"
            checked={smsConsent}
            onCheckedChange={(checked) => setSmsConsent(checked === true)}
            className="mt-1 shrink-0 rounded-none border-ink-500 data-[state=checked]:border-cta-ink data-[state=checked]:bg-cta-ink data-[state=checked]:text-white"
          />
          <span className="text-sm leading-relaxed text-ink-500">
            {pt
              ? PT_TRANSACTIONAL_CONSENT
              : t(
                  "By checking this box, I consent to receive transactional messages related to my account, orders, or services I have requested. These messages may include appointment reminders, order confirmations, and account notifications, among others. Message frequency may vary. Message & data rates may apply. Reply HELP for help or STOP to opt out.",
                )}
          </span>
        </Label>

        <Label htmlFor="marketing-consent" className={consentClass}>
          <Checkbox
            id="marketing-consent"
            checked={marketingConsent}
            onCheckedChange={(checked) => setMarketingConsent(checked === true)}
            className="mt-1 shrink-0 rounded-none border-ink-500 data-[state=checked]:border-cta-ink data-[state=checked]:bg-cta-ink data-[state=checked]:text-white"
          />
          <span className="text-sm leading-relaxed text-ink-500">
            {pt
              ? PT_MARKETING_CONSENT
              : t(
                  "By checking this box, I consent to receive marketing and promotional messages, including special offers, discounts, and new product updates, among others. Message frequency may vary. Message & data rates may apply. Reply HELP for help or STOP to opt out.",
                )}
          </span>
        </Label>

        <PillButton type="submit" variant="primary" disabled={submitting} className="w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
          <Send className="h-5 w-5" />
          {submitting ? t("Sending...") : t("Send Message")}
        </PillButton>

        <p className="pt-2 text-xs leading-relaxed text-ink-500">
          {pt ? (
            <>{PT_SUBMIT_CONSENT} </>
          ) : (
            <>
              {t("By submitting this form you agree to be contacted by")} <strong>{companyName}</strong>{" "}
              {t(
                "by phone, text, or email about your inquiry. Consent is not a condition of any purchase. Message and data rates may apply; message frequency varies. Reply STOP to unsubscribe. See our",
              )}{" "}
            </>
          )}
          <Link href="/privacy-policy" className={linkClass}>{t("Privacy Policy")}</Link> {t("and")}{" "}
          <Link href="/terms-of-service" className={linkClass}>{t("Terms of Service")}</Link>.
        </p>
      </form>
    </EditorialCard>
    <p className="mt-4 text-sm text-ink-500" data-testid="text-contact-reply-time">{t("We reply within one business day")}</p>
    </div>
  );
}
