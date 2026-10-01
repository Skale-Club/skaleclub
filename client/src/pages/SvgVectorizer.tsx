import { PageHeader } from "@/components/layout/PageHeader";
import { VectorizerSection } from "@/components/admin/vectorizer/VectorizerSection";
import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";

// Public, free logo vectorizer at /svg. Everything runs in the visitor's
// browser (Web Worker): no upload, no server cost.
export default function SvgVectorizer() {
  const { t } = useTranslation();
  usePageSeo({
    title: t("Free Logo to SVG Converter (PNG, JPG)"),
    description: t(
      "Convert a PNG or JPG logo into a clean, editable SVG for Figma, Illustrator and Fusion 360 — exact colors, real corners, no gaps. Free, runs in your browser.",
    ),
  });

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        compact
        eyebrow={t("Free tool")}
        title={t("Logo to SVG Converter")}
        subtitle={t("Turn a PNG or JPG logo into a clean, editable SVG for Figma, Illustrator and Fusion 360. Free, and your image never leaves your browser.")}
      />
      <div className="container-custom container-page py-10 md:py-14">
        <VectorizerSection embedded />
      </div>
    </div>
  );
}
