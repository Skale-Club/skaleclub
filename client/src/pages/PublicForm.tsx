import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { LeadFormModal } from '@/components/LeadFormModal';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2 } from '@/components/ui/loader';

type SlugParams = { slug: string };

/**
 * Public route `/f/:slug` that auto-opens `<LeadFormModal>` for the given form
 * slug. Intended for direct-share links (QR codes, email, etc.). If the slug
 * does not resolve to an active form, a minimal "Form not found" card is shown.
 */
export default function PublicForm() {
  const params = useParams<SlugParams>();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const slug = params?.slug;

  const [modalOpen, setModalOpen] = useState(true);

  // Probe the form config up front so we can render a 404 state instead of a
  // blank modal when the slug is wrong or archived.
  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/forms/slug/${slug}/config`],
    enabled: Boolean(slug),
    queryFn: async () => {
      const res = await fetch(`/api/forms/slug/${encodeURIComponent(slug!)}/config`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to load form');
      return res.json();
    },
    retry: false,
  });

  // When the modal is closed, navigate away so users don't get stuck on a
  // blank page.
  useEffect(() => {
    if (!modalOpen) {
      setLocation('/');
    }
  }, [modalOpen, setLocation]);

  if (!slug) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || data === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">{t('Form not found')}</h1>
          <p className="text-sm text-muted-foreground">
            {t("The form you're looking for is unavailable. Please double-check the link or go back to the homepage.")}
          </p>
          <Button asChild>
            <Link href="/">{t('Back to homepage')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <LeadFormModal open={modalOpen} onClose={() => setModalOpen(false)} formSlug={slug} />
    </div>
  );
}
