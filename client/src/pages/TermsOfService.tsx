import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  Sparkles,
  Users,
  CreditCard,
  Calendar,
  Home,
  CheckCircle2,
  AlertTriangle,
  Package,
  Repeat,
  Ban,
  Lock,
  Link,
  Bell,
  Gavel,
  Mail,
} from "lucide-react";
import type { CompanySettings } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";

export default function TermsOfService() {
  const { t } = useTranslation();
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const companyName = settings?.companyName || "Company Name";
  const companyEmail = settings?.companyEmail || "";
  const companyPhone = settings?.companyPhone || "";
  const companyAddress = settings?.companyAddress || "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="bg-primary text-white pt-28 pb-16">
        <div className="container-custom">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-10 h-10" />
            <h1 className="text-4xl font-bold font-heading text-white">{t('Terms of Service')}</h1>
          </div>
          <p className="text-primary-foreground/80 text-lg max-w-2xl">
            {t(`These terms govern your use of ${companyName}'s website and services. Please read them carefully before using our platform.`)}
          </p>
          <p className="text-primary-foreground/60 mt-4 text-sm">
            {t('Last updated: January 10, 2026')}
          </p>
        </div>
      </div>

      <div className="container-custom py-12">
        <div className="space-y-12">
          <Section icon={<ShieldCheck className="w-6 h-6" />} title={t('1. Acceptance of Terms')}>
            <p>{t(`By accessing the site, creating an account, or requesting services with ${companyName}, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use our services.`)}</p>
          </Section>

          <Section icon={<Sparkles className="w-6 h-6" />} title={t('2. Services and Scope')}>
            <p>{t('We provide digital marketing services including lead generation, advertising management, and growth consulting for service businesses. Service details, deliverables, and exclusions may vary by package and engagement type.')}</p>
          </Section>

          <Section icon={<Users className="w-6 h-6" />} title={t('3. Eligibility and Accounts')}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('You must be at least 18 years old and legally able to enter binding contracts.')}</li>
              <li>{t('You agree to provide accurate contact, access, and billing information and to keep it updated.')}</li>
              <li>{t('You are responsible for safeguarding account credentials and all activity under your account.')}</li>
            </ul>
          </Section>

          <Section icon={<CreditCard className="w-6 h-6" />} title={t('4. Quotes, Pricing, and Payments')}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('Prices, estimates, and promotions are shown in your proposal and may adjust based on scope, add-ons, or special requests.')}</li>
              <li>{t('Taxes and fees may apply. We may place an authorization hold or charge your payment method per your signed service terms.')}</li>
              <li>{t('If project conditions differ materially from the approved scope, we may adjust deliverables or pricing with your consent before proceeding.')}</li>
            </ul>
          </Section>

          <Section icon={<Calendar className="w-6 h-6" />} title={t('5. Scheduling, Rescheduling, and Cancellations')}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('Appointments are subject to availability. Arrival times may include a service window to account for traffic and prior jobs.')}</li>
              <li>{t('Reschedules or cancellations should be requested as early as possible. Late changes may incur a fee if notice is shorter than the policy in your service agreement.')}</li>
              <li>{t('We may reschedule or cancel due to unsafe conditions, severe weather, or events outside our control; in such cases we will work with you to find a new time.')}</li>
            </ul>
          </Section>

          <Section icon={<Home className="w-6 h-6" />} title={t('6. Access, Safety, and Preparation')}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('You agree to provide safe, timely access (keys, codes, parking, gate instructions) for the scheduled appointment.')}</li>
              <li>{t('Please secure valuables, inform us of pets, and disclose hazards (fragile items, infestations, biohazards, sharp objects).')}</li>
              <li>{t('We may decline or pause service if conditions are unsafe for our team or could damage your property.')}</li>
            </ul>
          </Section>

          <Section icon={<CheckCircle2 className="w-6 h-6" />} title={t('7. Service Quality and Re-Cleans')}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('Services follow the checklist for your selected package. Certain items (e.g., mold remediation, extreme clutter) may be excluded unless agreed in writing.')}</li>
              <li>{t('If something was missed, contact us within 24 hours with details and photos. We may offer a re-clean of the affected areas at our discretion.')}</li>
              <li>{t('Re-cleans do not cover new messes, wear and tear, or issues unrelated to the original visit.')}</li>
            </ul>
          </Section>

          <Section icon={<AlertTriangle className="w-6 h-6" />} title={t('8. Customer Responsibilities and Conduct')}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('Treat staff respectfully and provide a safe working environment free from harassment, discrimination, or threats.')}</li>
              <li>{t('Advise us of any special surface requirements (e.g., marble, specialty finishes) before service begins.')}</li>
              <li>{t('We are not responsible for pre-existing damage or instability (loose fixtures, broken blinds, unsecured shelves).')}</li>
            </ul>
          </Section>

          <Section icon={<Package className="w-6 h-6" />} title={t('9. Marketing Materials and Assets')}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('We may create marketing materials, ads, and content as part of our services. You grant us permission to use your business information and approved assets for marketing purposes.')}</li>
              <li>{t('You are responsible for providing accurate business information and approving any public-facing materials before launch.')}</li>
            </ul>
          </Section>

          <Section icon={<Repeat className="w-6 h-6" />} title={t('10. Recurring Services and Subscriptions')}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('Recurring schedules (weekly, biweekly, monthly) are subject to calendar availability and may shift around holidays.')}</li>
              <li>{t('Pricing may change if the scope, frequency, or property condition changes. We will notify you of adjustments before charging.')}</li>
              <li>{t('You may pause or cancel recurring services with notice as described in your service agreement.')}</li>
            </ul>
          </Section>

          <Section icon={<Ban className="w-6 h-6" />} title={t('11. Limitations of Liability')}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('To the fullest extent permitted by law, we are not liable for indirect, incidental, or consequential damages.')}</li>
              <li>{t('Our aggregate liability for any claim is limited to the amount you paid for the service giving rise to the claim.')}</li>
              <li>{t('We are not responsible for losses arising from undisclosed hazards, improper installations, or normal wear and tear.')}</li>
            </ul>
          </Section>

          <Section icon={<Lock className="w-6 h-6" />} title={t('12. Intellectual Property and Acceptable Use')}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t(`All site content, trademarks, and materials are owned by ${companyName} or its licensors and may not be copied or used without permission.`)}</li>
              <li>{t('You agree not to misuse the site (including scraping, reverse engineering, or interfering with security features) or use our brand without consent.')}</li>
            </ul>
          </Section>

          <Section icon={<Link className="w-6 h-6" />} title={t('13. Third-Party Services and Links')}>
            <p>{t('We may reference or integrate third-party services (e.g., payments, scheduling). Those providers\' terms and privacy policies apply to their services; we are not responsible for their content or practices.')}</p>
          </Section>

          <Section icon={<Bell className="w-6 h-6" />} title={t('14. Changes and Termination')}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('We may update these terms periodically. The "Last updated" date reflects the latest version. Continued use after changes means you accept the revised terms.')}</li>
              <li>{t('We may suspend or terminate access if you violate these terms, create unsafe conditions, or engage in fraud or abuse.')}</li>
            </ul>
          </Section>

          <Section icon={<Gavel className="w-6 h-6" />} title={t('15. Governing Law and Dispute Resolution')}>
            <p>{t(`These terms are governed by the laws of the jurisdiction where ${companyName} operates, without regard to conflict-of-law principles. Please contact us first to try to resolve any issue informally.`)}</p>
          </Section>

          <Section icon={<Mail className="w-6 h-6" />} title={t('16. Contact')}>
            <p>{t('If you have questions or concerns about these Terms of Service, contact us:')}</p>
            <div className="mt-4 p-6 bg-gray-50 rounded-lg">
              <p className="font-semibold text-gray-900">{companyName}</p>
              {companyEmail && (
                <p className="text-gray-600 mt-2">
                  {t('Email:')} <a href={`mailto:${companyEmail}`} className="text-primary hover:underline">{companyEmail}</a>
                </p>
              )}
              {companyPhone && (
                <p className="text-gray-600">
                  {t('Phone:')} <a href={`tel:${companyPhone}`} className="text-primary hover:underline">{companyPhone}</a>
                </p>
              )}
              {companyAddress && (
                <p className="text-gray-600">{t('Address:')} {companyAddress}</p>
              )}
            </div>
            <p className="mt-4 text-gray-600">{t('We aim to respond to inquiries within 30 days.')}</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-primary">{icon}</div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="prose prose-gray max-w-none space-y-4 text-gray-600">
        {children}
      </div>
    </section>
  );
}
