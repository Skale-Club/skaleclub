import { usePageSeo } from "@/hooks/use-seo";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { Band, Eyebrow } from "@/components/editorial";
import { ContactDetails } from "@/components/contact/ContactDetails";
import { ContactForm } from "@/components/contact/ContactForm";

export default function Contact() {
  const { t } = useTranslation();
  usePageSeo({ title: t("Contact"), description: t("Get in touch with Skale Club. Call, email or send us a message and we will get back to you.") });
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  return (
    <div>
      <Band tone="hero" pattern containerClassName="page-top pb-14 sm:pb-20">
        <Eyebrow>{t("Contact")}</Eyebrow>
        <h1 className="mt-6 max-w-4xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-fog-50 sm:text-6xl">
          {t("Contact Us")}
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-fog-400 sm:text-xl">
          {t("Have questions about our services or need a custom quote? We're here to help. Reach out to us today.")}
        </p>
      </Band>

      <Band tone="cream">
        <div className="grid items-start gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-14">
          <ContactForm companyName={companySettings?.companyName || "Skale Club"} />
          <div className="lg:order-first">
            <ContactDetails
              phone={companySettings?.companyPhone || ""}
              email={companySettings?.companyEmail || ""}
              address={companySettings?.companyAddress || ""}
            />
          </div>
        </div>
      </Band>
    </div>
  );
}
