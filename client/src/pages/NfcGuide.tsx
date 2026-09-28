import { NfcProductGuideSection } from "@/components/pages/sections/NfcProductGuideSection";
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

  return <NfcProductGuideSection props={{ orderHref: "/nfc-order" }} />;
}
