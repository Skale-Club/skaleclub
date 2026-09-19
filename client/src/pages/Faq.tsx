import { usePageSeo } from "@/hooks/use-seo";
import { useQuery } from '@tanstack/react-query';
import type { Faq } from '@shared/schema';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2 } from '@/components/ui/loader';
import { PageHeader } from '@/components/layout/PageHeader';
import { FaqList } from '@/components/FaqList';

export default function FaqPage() {
  const { t } = useTranslation();
  usePageSeo({ title: t("FAQ"), description: t("Find answers to common questions about our services.") });
  const { data: faqs, isLoading } = useQuery<Faq[]>({
    queryKey: ['/api/faqs']
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="pt-24">
        <PageHeader
          title={t('Frequently Asked Questions')}
          subtitle={t('Find answers to common questions about our services.')}
        />
      </div>

      <div className="container-custom mx-auto px-4 sm:px-6 tablet:px-0 py-16 md:py-24">
        {isLoading ? (
          <div className="flex w-full justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto bg-white text-slate-900 rounded-2xl shadow-sm p-6 md:p-8">
            <FaqList
              items={(faqs ?? []).map((faq) => ({ question: t(faq.question), answer: t(faq.answer) }))}
              emptyMessage={t('No FAQs available yet. Check back soon!')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
