import { useEffect } from "react";
import { PillButton, PillLink } from "@/components/editorial";
import { useTranslation } from "@/hooks/useTranslation";
import { nfcWhatsappHref } from "@shared/nfc-whatsapp";

/** Branded last-resort page for an uncaught render error anywhere in the router. */
export function AppErrorFallback() {
  const { t, language } = useTranslation();

  useEffect(() => {
    // index.html's pre-React loader sits above everything at z-index 9999.
    document.getElementById("initial-loader")?.remove();
  }, []);

  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950 px-6 text-center text-white"
    >
      <div className="flex max-w-md flex-col items-center gap-5">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("Something went wrong on our side")}</h1>
        <p className="text-fog-300">{t("An unexpected error stopped this page. Reloading usually fixes it.")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <PillButton onClick={() => window.location.reload()}>{t("Reload")}</PillButton>
          <PillLink
            variant="ghost"
            href={nfcWhatsappHref(language === "pt" ? "pt" : "en")}
            target="_blank"
          >
            {t("Talk to us on WhatsApp")}
          </PillLink>
        </div>
      </div>
    </div>
  );
}
