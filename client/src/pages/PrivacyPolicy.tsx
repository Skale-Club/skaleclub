import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <div className="container-custom mx-auto py-20">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <h2>1. Introduction</h2>
          <p>Welcome to Skleanings. We value your privacy and are committed to protecting your personal data.</p>
          <h2>2. Data Collection</h2>
          <p>We collect information you provide directly to us when you book a service, create an account, or communicate with us.</p>
          <h2>3. Use of Data</h2>
          <p>We use the data we collect to provide, maintain, and improve our services, and to communicate with you about your bookings.</p>
          <h2>4. Data Protection</h2>
          <p>We implement appropriate technical and organizational measures to protect the security of your personal data.</p>
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
