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
          <h2>2. Service Booking</h2>
          <p>Bookings are subject to availability and confirmation. We reserve the right to refuse service to anyone for any reason.</p>
          <h2>3. Cancellations and Refunds</h2>
          <p>Please refer to our cancellation policy for details on refunds and rescheduling.</p>
          <h2>4. Limitation of Liability</h2>
          <p>Skleanings shall not be liable for any indirect, incidental, or consequential damages resulting from the use of our services.</p>
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
