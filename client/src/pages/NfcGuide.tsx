import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { NfcProductGuideSection } from "@/components/pages/sections/NfcProductGuideSection";
import { useLeadConversion } from "@/hooks/useLeadConversion";
import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";

export default function NfcGuide() {
  const { t } = useTranslation();

  usePageSeo({
    title: t("NFC Keychain Guide: Models, Pricing and FAQs"),
    description: t(
      "Understand flat, raised-relief and custom-shaped NFC keychains, what changes the price, phone compatibility, artwork and the complete order process.",
    ),
  });

  // The keychain order form lands here (its `completionRedirect`) with ?form=<slug>:
  // this visit is the lead conversion, and the person gets a receipt on top.
  const [formSlug] = useState(() => new URLSearchParams(window.location.search).get("form"));
  useLeadConversion(formSlug, Boolean(formSlug));
  const [showReceipt, setShowReceipt] = useState(Boolean(formSlug));

  return (
    <>
      {showReceipt && (
        <div
          role="status"
          className="fixed inset-x-4 top-[calc(var(--nav-offset,5rem)+0.75rem)] z-40 mx-auto flex max-w-2xl items-start gap-3 border border-cta-soft/30 bg-navy-800/95 p-4 text-sm leading-6 text-fog-200 shadow-[0_22px_60px_rgba(0,0,0,.35)] backdrop-blur-md"
          data-testid="nfc-guide-receipt"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cta-soft" aria-hidden="true" />
          <p className="flex-1">
            <strong className="font-semibold text-fog-50">{t("Order received.")}</strong>{" "}
            {t("We call you on WhatsApp to confirm everything before production. Meanwhile, here is the full guide.")}
          </p>
          <button
            type="button"
            onClick={() => setShowReceipt(false)}
            aria-label={t("Close")}
            className="-m-1 rounded-full p-1 text-fog-400 transition hover:text-fog-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <NfcProductGuideSection props={{ orderHref: "/nfc-order" }} />
    </>
  );
}
