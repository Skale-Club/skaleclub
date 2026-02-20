import { useQuery } from '@tanstack/react-query';
import type { Faq } from '@shared/schema';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function FaqPage() {
  const { t } = useTranslation();
  const { data: faqs, isLoading } = useQuery<Faq[]>({
    queryKey: ['/api/faqs']
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="container-custom mx-auto py-20">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{t('Frequently Asked Questions')}</h1>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">
            {t('Find answers to common questions about our services.')}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !faqs || faqs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg">{t('No FAQs available yet. Check back soon!')}</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-6 md:p-8">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq) => (
                <AccordionItem
                  key={faq.id}
                  value={`faq-${faq.id}`}
                  className="border-b border-slate-200"
                  data-testid={`faq-accordion-${faq.id}`}
                >
                  <AccordionTrigger
                    className="text-left text-lg font-medium py-5 hover:no-underline"
                    data-testid={`faq-trigger-${faq.id}`}
                  >
                    {t(faq.question)}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 pb-5 text-base whitespace-pre-wrap">
                    {t(faq.answer)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </div>
    </div>
  );
}
