import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FaqListItem {
  question: string;
  answer: string;
}

interface FaqListProps {
  items: FaqListItem[];
  emptyMessage?: string;
  dark?: boolean;
}

/**
 * Shared FAQ accordion used by the standalone FAQ page and the
 * `faqAccordion` landing section, so both read as one component.
 */
export function FaqList({ items, emptyMessage, dark = false }: FaqListProps) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className={dark ? "text-zinc-300 text-lg" : "text-slate-500 text-lg"}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((item, idx) => (
        <AccordionItem
          key={idx}
          value={`faq-${idx}`}
          className={dark ? "border-white/10" : "border-slate-200"}
          data-testid={`faq-item-${idx + 1}`}
        >
          <AccordionTrigger
            className={`text-left text-lg font-medium py-5 hover:no-underline ${dark ? "text-white" : ""}`}
            data-testid={`faq-trigger-${idx + 1}`}
          >
            {item.question}
          </AccordionTrigger>
          <AccordionContent
            className={`pb-5 text-base whitespace-pre-wrap ${dark ? "text-zinc-300" : "text-slate-600"}`}
          >
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export default FaqList;
