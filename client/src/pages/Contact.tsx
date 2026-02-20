import { Mail, Phone, MapPin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { trackEvent } from "@/lib/analytics";
import { useTranslation } from "@/hooks/useTranslation";

export default function Contact() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const phone = companySettings?.companyPhone || "";
  const email = companySettings?.companyEmail || "";
  const address = companySettings?.companyAddress || "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: t("Message Sent"),
      description: t("We'll get back to you as soon as possible."),
    });
  };

  return (
    <div className="pt-24 pb-20">
      <div className="container-custom mx-auto">
        <div className="max-w-3xl mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">{t('Contact Us')}</h1>
          <p className="text-xl text-slate-600 leading-relaxed">
            {t("Have questions about our services or need a custom quote? We're here to help. Reach out to us today.")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('Full Name')}</label>
                  <Input placeholder="John Doe" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('Email Address')}</label>
                  <Input type="email" placeholder="john@example.com" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('Subject')}</label>
                <Input placeholder={t("How can we help?")} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('Message')}</label>
                <Textarea placeholder={t("Tell us more about your needs...")} className="min-h-[150px]" required />
              </div>
              <Button type="submit" className="w-full md:w-auto px-8 py-6 rounded-full text-lg">
                <Send className="w-5 h-5 mr-2" />
                {t('Send Message')}
              </Button>
            </form>
          </div>

          <div className="space-y-8">
            <div className="p-8 bg-blue-50 rounded-3xl border border-blue-100">
              <h3 className="text-xl font-bold mb-6">{t('Get in Touch')}</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{t('Call Us')}</p>
                    {phone ? (
                      <a
                        href={`tel:${phone.replace(/\D/g, '')}`}
                        onClick={() => trackEvent('click_call', { location: 'contact_page', label: phone })}
                        className="text-primary hover:underline"
                      >
                        {phone}
                      </a>
                    ) : (
                      <p className="text-slate-600">{t('Contact us for phone')}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{t('Email Us')}</p>
                    {email ? (
                      <a
                        href={`mailto:${email}`}
                        onClick={() => trackEvent('click_email', { location: 'contact_page', label: email })}
                        className="text-primary hover:underline break-all"
                      >
                        {email}
                      </a>
                    ) : (
                      <p className="text-slate-600">{t('Contact us for email')}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{t('Visit Us')}</p>
                    <p className="text-slate-600">{address || t("Contact us for address")}</p>
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
