import { Shield, Eye, Lock, Users, Cookie, FileText, Mail, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";

export default function PrivacyPolicy() {
  const { t } = useTranslation();
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const companyName = settings?.companyName || "Company Name";
  const companyEmail = settings?.companyEmail || "contact@company.com";
  const companyPhone = settings?.companyPhone || "";
  const companyAddress = settings?.companyAddress || "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-primary text-white pt-28 pb-16">
        <div className="container-custom">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-10 h-10" />
            <h1 className="text-4xl font-bold font-heading text-white">{t('Privacy Policy')}</h1>
          </div>
          <p className="text-primary-foreground/80 text-lg max-w-2xl">
            {t(`Your privacy is important to us. This policy explains how ${companyName} collects, uses, and protects your personal information.`)}
          </p>
          <p className="text-primary-foreground/60 mt-4 text-sm">
            {t('Last updated: January 10, 2026')}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container-custom py-12">
        <div className="space-y-12">

          {/* Introduction */}
          <Section
            icon={<FileText className="w-6 h-6" />}
            title={t('1. Introduction')}
          >
            <p>
              {t(`Welcome to ${companyName} ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our marketing services.`)}
            </p>
            <p>
              {t('By using our services, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.')}
            </p>
          </Section>

          {/* Information We Collect */}
          <Section
            icon={<Eye className="w-6 h-6" />}
            title={t('2. Information We Collect')}
          >
            <p>{t('We collect information that you provide directly to us and information collected automatically when you use our services.')}</p>

            <h4 className="font-semibold text-gray-900 mt-6 mb-3">{t('Personal Information You Provide')}</h4>
            <ul className="list-disc space-y-2">
              <li><strong>{t('Contact Information:')}</strong> {t('Name, email address, phone number, and mailing address')}</li>
              <li><strong>{t('Service Details:')}</strong> {t('Service preferences, campaign goals, and project information')}</li>
              <li><strong>{t('Payment Information:')}</strong> {t('Credit card numbers, billing address (processed securely through our payment providers)')}</li>
              <li><strong>{t('Communications:')}</strong> {t('Messages, feedback, and correspondence you send to us')}</li>
              <li><strong>{t('Account Information:')}</strong> {t('Username, password, and profile preferences')}</li>
            </ul>

            <h4 className="font-semibold text-gray-900 mt-6 mb-3">{t('Information Collected Automatically')}</h4>
            <ul className="list-disc space-y-2">
              <li><strong>{t('Device Information:')}</strong> {t('IP address, browser type, operating system, and device identifiers')}</li>
              <li><strong>{t('Usage Data:')}</strong> {t('Pages visited, time spent on pages, click patterns, and referring URLs')}</li>
              <li><strong>{t('Location Data:')}</strong> {t('General geographic location based on IP address')}</li>
            </ul>
          </Section>

          {/* How We Use Your Information */}
          <Section
            icon={<Users className="w-6 h-6" />}
            title={t('3. How We Use Your Information')}
          >
            <p>{t('We use the information we collect for various purposes, including:')}</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>{t('Service Delivery:')}</strong> {t('To schedule, provide, and manage your marketing services')}</li>
              <li><strong>{t('Communication:')}</strong> {t('To send service updates, reminders, and project notifications')}</li>
              <li><strong>{t('Customer Support:')}</strong> {t('To respond to your inquiries and resolve issues')}</li>
              <li><strong>{t('Payment Processing:')}</strong> {t('To process transactions and send invoices')}</li>
              <li><strong>{t('Improvement:')}</strong> {t('To analyze usage patterns and improve our services')}</li>
              <li><strong>{t('Marketing:')}</strong> {t('To send promotional offers and newsletters (with your consent)')}</li>
              <li><strong>{t('Legal Compliance:')}</strong> {t('To comply with legal obligations and protect our rights')}</li>
            </ul>
          </Section>

          {/* Information Sharing */}
          <Section
            icon={<Users className="w-6 h-6" />}
            title={t('4. Information Sharing and Disclosure')}
          >
            <p>{t('We do not sell your personal information. We may share your information in the following circumstances:')}</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>{t('Service Providers:')}</strong> {t('With trusted third parties who assist in operating our business (payment processors, scheduling software, email services)')}</li>
              <li><strong>{t('Marketing Professionals:')}</strong> {t('With our marketing staff to the extent necessary to provide services')}</li>
              <li><strong>{t('Legal Requirements:')}</strong> {t('When required by law, court order, or government request')}</li>
              <li><strong>{t('Business Transfers:')}</strong> {t('In connection with a merger, acquisition, or sale of assets')}</li>
              <li><strong>{t('With Your Consent:')}</strong> {t('When you have given us permission to share your information')}</li>
            </ul>
          </Section>

          {/* Data Security */}
          <Section
            icon={<Lock className="w-6 h-6" />}
            title={t('5. Data Security')}
          >
            <p>
              {t('We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:')}
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>{t('Encryption of data in transit using SSL/TLS technology')}</li>
              <li>{t('Secure storage of sensitive information')}</li>
              <li>{t('Regular security assessments and updates')}</li>
              <li>{t('Access controls limiting who can view your information')}</li>
              <li>{t('Employee training on data protection practices')}</li>
            </ul>
            <p className="mt-4">
              {t('However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.')}
            </p>
          </Section>

          {/* Cookies */}
          <Section
            icon={<Cookie className="w-6 h-6" />}
            title={t('6. Cookies and Tracking Technologies')}
          >
            <p>{t('We use cookies and similar tracking technologies to enhance your experience on our website:')}</p>

            <h4 className="font-semibold text-gray-900 mt-6 mb-3">{t('Types of Cookies We Use')}</h4>
            <ul className="list-disc space-y-2">
              <li><strong>{t('Essential Cookies:')}</strong> {t('Required for the website to function properly (e.g., session management)')}</li>
              <li><strong>{t('Analytics Cookies:')}</strong> {t('Help us understand how visitors interact with our website (e.g., Google Analytics)')}</li>
              <li><strong>{t('Marketing Cookies:')}</strong> {t('Used to deliver relevant advertisements and track campaign effectiveness')}</li>
            </ul>

            <p className="mt-4">
              {t('You can control cookie preferences through your browser settings. Note that disabling certain cookies may affect website functionality.')}
            </p>
          </Section>

          {/* Your Rights */}
          <Section
            icon={<Shield className="w-6 h-6" />}
            title={t('7. Your Privacy Rights')}
          >
            <p>{t('Depending on your location, you may have the following rights regarding your personal information:')}</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>{t('Access:')}</strong> {t('Request a copy of the personal information we hold about you')}</li>
              <li><strong>{t('Correction:')}</strong> {t('Request correction of inaccurate or incomplete information')}</li>
              <li><strong>{t('Deletion:')}</strong> {t('Request deletion of your personal information (subject to legal retention requirements)')}</li>
              <li><strong>{t('Opt-Out:')}</strong> {t('Unsubscribe from marketing communications at any time')}</li>
              <li><strong>{t('Data Portability:')}</strong> {t('Request your data in a structured, commonly used format')}</li>
              <li><strong>{t('Withdraw Consent:')}</strong> {t('Withdraw previously given consent for data processing')}</li>
            </ul>
            <p className="mt-4">
              {t('To exercise any of these rights, please contact us using the information provided below.')}
            </p>
          </Section>

          {/* Data Retention */}
          <Section
            icon={<FileText className="w-6 h-6" />}
            title={t('8. Data Retention')}
          >
            <p>
              {t('We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law. Specifically:')}
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>{t('Account information is retained while your account remains active')}</li>
              <li>{t('Service records are retained for 7 years for tax and legal purposes')}</li>
              <li>{t('Marketing preferences are retained until you opt out')}</li>
              <li>{t('Analytics data is retained in anonymized form indefinitely')}</li>
            </ul>
          </Section>

          {/* Children's Privacy */}
          <Section
            icon={<Users className="w-6 h-6" />}
            title={t("9. Children's Privacy")}
          >
            <p>
              {t('Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately, and we will take steps to delete such information.')}
            </p>
          </Section>

          {/* Changes to Policy */}
          <Section
            icon={<Bell className="w-6 h-6" />}
            title={t('10. Changes to This Privacy Policy')}
          >
            <p>
              {t('We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will notify you of any material changes by:')}
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>{t('Posting the updated policy on our website')}</li>
              <li>{t('Updating the "Last updated" date at the top of this page')}</li>
              <li>{t('Sending an email notification for significant changes (if you have an account)')}</li>
            </ul>
            <p className="mt-4">
              {t('We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information.')}
            </p>
          </Section>

          {/* Contact Us */}
          <Section
            icon={<Mail className="w-6 h-6" />}
            title={t('11. Contact Us')}
          >
            <p>
              {t('If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:')}
            </p>
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
            <p className="mt-4 text-gray-600">
              {t('We will respond to your inquiry within 30 days.')}
            </p>
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
