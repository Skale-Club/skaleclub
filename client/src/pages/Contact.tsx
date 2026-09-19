import { usePageSeo } from "@/hooks/use-seo";
import { useState } from "react";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { trackEvent } from "@/lib/analytics";
import { useTranslation } from "@/hooks/useTranslation";
import { Link } from "wouter";
import { PageHeader } from "@/components/layout/PageHeader";

export default function Contact() {
  const { t } = useTranslation();
  usePageSeo({ title: t("Contact"), description: t("Get in touch with Skale Club. Call, email or send us a message and we will get back to you.") });
  const { toast } = useToast();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const phone = companySettings?.companyPhone || "";
  const email = companySettings?.companyEmail || "";
  const address = companySettings?.companyAddress || "";
  const companyName = companySettings?.companyName || "Skale Club";

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

  return (
    <div className="pt-24 pb-20">
      <PageHeader
        title={t("Contact Us")}
        subtitle={t(
          "Have questions about our services or need a custom quote? We're here to help. Reach out to us today.",
        )}
      />

      <div className="container-custom mx-auto px-4 sm:px-6 tablet:px-0 pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Form */}
          <div className="lg:col-span-2">
            <form
              onSubmit={handleSubmit}
              className="space-y-6 bg-card border rounded-2xl p-8 shadow-sm"
            >
              {/* Name + Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="contact-name" className="text-sm font-medium text-foreground">
                    {t("Full Name")}
                  </label>
                  <Input
                    id="contact-name"
                  value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="contact-email" className="text-sm font-medium text-foreground">
                    {t("Email Address")}
                  </label>
                  <Input
                    type="email"
                    id="contact-email"
                  value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label htmlFor="contact-phone" className="text-sm font-medium text-foreground">
                  {t("Phone Number")}
                </label>
                <Input
                  type="tel"
                  id="contact-phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  required
                />
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label htmlFor="contact-subject" className="text-sm font-medium text-foreground">
                  {t("Subject")}
                </label>
                <Input
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("How can we help?")}
                  required
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label htmlFor="contact-message" className="text-sm font-medium text-foreground">
                  {t("Message")}
                </label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("Tell us more about your needs...")}
                  className="min-h-[150px]"
                  required
                />
              </div>

              {/* SMS Consent — Transactional */}
              <Label
                htmlFor="sms-consent"
                className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-muted/40 transition-colors font-normal"
              >
                <Checkbox
                  id="sms-consent"
                  checked={smsConsent}
                  onCheckedChange={(checked) => setSmsConsent(checked === true)}
                  className="mt-1 shrink-0"
                />
                <span className="text-sm text-muted-foreground leading-relaxed">
                  {t(
                    "By checking this box, I consent to receive transactional messages related to my account, orders, or services I have requested. These messages may include appointment reminders, order confirmations, and account notifications, among others. Message frequency may vary. Message & data rates may apply. Reply HELP for help or STOP to opt out.",
                  )}
                </span>
              </Label>

              {/* SMS Consent — Marketing */}
              <Label
                htmlFor="marketing-consent"
                className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-muted/40 transition-colors font-normal"
              >
                <Checkbox
                  id="marketing-consent"
                  checked={marketingConsent}
                  onCheckedChange={(checked) => setMarketingConsent(checked === true)}
                  className="mt-1 shrink-0"
                />
                <span className="text-sm text-muted-foreground leading-relaxed">
                  {t(
                    "By checking this box, I consent to receive marketing and promotional messages, including special offers, discounts, and new product updates, among others. Message frequency may vary. Message & data rates may apply. Reply HELP for help or STOP to opt out.",
                  )}
                </span>
              </Label>

              {/* Submit */}
              <Button
                type="submit"
                disabled={submitting}
                variant="cta"
                size="pill"
                className="w-full md:w-auto text-lg"
              >
                <Send className="w-5 h-5 mr-2" />
                {submitting ? t("Sending...") : t("Send Message")}
              </Button>

              {/* TCPA / A2P Disclaimer */}
              <p className="text-xs text-muted-foreground leading-relaxed pt-2">
                {t(
                  "By submitting this form you agree to be contacted by",
                )}{" "}
                <strong>{companyName}</strong>{" "}
                {t(
                  "by phone, text, or email about your inquiry. Consent is not a condition of any purchase. Message and data rates may apply; message frequency varies. Reply STOP to unsubscribe. See our",
                )}{" "}
                <Link
                  href="/privacy-policy"
                  className="underline hover:text-foreground transition-colors"
                >
                  {t("Privacy Policy")}
                </Link>{" "}
                {t("and")}{" "}
                <Link
                  href="/terms-of-service"
                  className="underline hover:text-foreground transition-colors"
                >
                  {t("Terms of Service")}
                </Link>
                .
              </p>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="p-8 bg-primary/5 border rounded-2xl">
              <h3 className="text-xl font-bold mb-6 text-foreground">
                {t("Get in Touch")}
              </h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{t("Call Us")}</p>
                    {phone ? (
                      <a
                        href={`tel:${phone.replace(/\D/g, "")}`}
                        onClick={() =>
                          trackEvent("click_call", {
                            location: "contact_page",
                            label: phone,
                          })
                        }
                        className="text-primary hover:underline"
                      >
                        {phone}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">
                        {t("Contact us for phone")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{t("Email Us")}</p>
                    {email ? (
                      <a
                        href={`mailto:${email}`}
                        onClick={() =>
                          trackEvent("click_email", {
                            location: "contact_page",
                            label: email,
                          })
                        }
                        className="text-primary hover:underline break-all"
                      >
                        {email}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">
                        {t("Contact us for email")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{t("Visit Us")}</p>
                    <p className="text-muted-foreground">
                      {address || t("Contact us for address")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
