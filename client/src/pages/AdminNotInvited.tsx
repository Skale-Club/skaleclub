import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AuthHeading, AuthLayout, AUTH_SECONDARY_BUTTON } from '@/components/admin/AuthLayout';
import type { CompanySettings } from '@shared/schema';
import { usePageSeo } from '@/hooks/use-seo';

/** Shown when a phone or Google account verified fine but belongs to no invited admin. */
export default function AdminNotInvited() {
  usePageSeo({ title: 'Not invited', noindex: true });

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  const [, setLocation] = useLocation();

  return (
    <AuthLayout
      logoUrl={companySettings?.logoMain}
      companyName={companySettings?.companyName || 'Skale Club'}
      onBack={() => setLocation('/')}
    >
      <AuthHeading
        eyebrow="Admin access"
        title="You are not invited yet"
        description="That phone number or Google account is not on the team. Ask an administrator to add it, then try again."
      />
      <Button
        type="button"
        className={AUTH_SECONDARY_BUTTON}
        onClick={() => setLocation('/admin/login')}
        data-testid="button-back-to-login"
      >
        Back to sign in
      </Button>
    </AuthLayout>
  );
}
