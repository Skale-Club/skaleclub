import { Card, CardContent } from "@/components/ui/card";

export default function TermsOfService() {
  return (
    <div className="container-custom mx-auto py-20">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <h2>1. Agreement to Terms</h2>
          <p>By accessing or using Skleanings services, you agree to be bound by these Terms of Service.</p>
          <h2>2. Eligibility and Account</h2>
          <p>You must be at least 18 years old to book services. You are responsible for maintaining the accuracy of your contact and address information.</p>
          <h2>3. Service Booking</h2>
          <p>Bookings are subject to availability and confirmation. We reserve the right to refuse or cancel service requests at our discretion.</p>
          <h2>4. Pricing and Payments</h2>
          <p>Prices are shown at checkout and may vary based on property size, service type, or add-ons. Payment is due at the time of booking unless otherwise agreed in writing.</p>
          <h2>5. Cancellations and Rescheduling</h2>
          <p>Cancellation and reschedule requests must be submitted in advance of the appointment. Fees may apply based on the timing and service type.</p>
          <h2>6. Access and Preparation</h2>
          <p>You agree to provide safe access to the property at the scheduled time, including entry instructions, parking details, and alarm information if applicable.</p>
          <h2>7. Service Standards</h2>
          <p>Our team performs services according to the checklist for the selected package. If you are not satisfied, contact us within 24 hours so we can address the issue.</p>
          <h2>8. Damage and Claims</h2>
          <p>Please report any damage or loss within 24 hours of service. Our liability is limited to the cost of the affected service unless otherwise required by law.</p>
          <h2>9. Supplies and Equipment</h2>
          <p>We provide standard cleaning supplies unless a specific arrangement is made. You are responsible for disclosing any special material or surface requirements.</p>
          <h2>10. Health and Safety</h2>
          <p>You must disclose any hazards, infestations, or unsafe conditions. We may pause or refuse service if conditions pose a risk to staff or property.</p>
          <h2>11. Subscriptions and Recurring Services</h2>
          <p>Recurring services can be paused or canceled with notice. Pricing and availability may change with future appointments.</p>
          <h2>12. Communications</h2>
          <p>By booking, you consent to receive service-related communications via email or phone. You may opt out of promotional messages at any time.</p>
          <h2>13. Intellectual Property</h2>
          <p>All website content, branding, and materials are owned by Skleanings and may not be used without permission.</p>
          <h2>14. Third-Party Links</h2>
          <p>We may link to third-party sites. We are not responsible for their content, policies, or practices.</p>
          <h2>15. Termination</h2>
          <p>We may suspend or terminate service access if you violate these terms or engage in abusive behavior.</p>
          <h2>16. Changes to Terms</h2>
          <p>We may update these Terms of Service from time to time. Continued use of our services means you accept the updated terms.</p>
          <h2>17. Governing Law</h2>
          <p>These terms are governed by the laws of the jurisdiction where Skleanings operates, without regard to conflict of law principles.</p>
          <h2>18. Contact</h2>
          <p>If you have questions about these terms, please contact us using the information provided on our website.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function CardHeader({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={`p-6 pb-0 ${className}`}>{children}</div>;
}

function CardTitle({ children, className }: { children: React.ReactNode, className?: string }) {
  return <h1 className={`text-2xl font-semibold leading-none tracking-tight ${className}`}>{children}</h1>;
}
