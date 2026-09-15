import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Info, Loader2, Palette, LayoutTemplate } from "lucide-react";
import type { CompanySettings, PortfolioService } from "@shared/schema";

import { buildCatalog, SOURCE_LABEL, type FolderItemSource } from "@/print/items";
import { MM_TO_PX, PAPER_PRESETS, type PaperKey } from "@/print/paper";
import { CropMarks, Guides, INK } from "@/print/primitives";
import { DEFAULT_TEMPLATE_ID, FOLDER_TEMPLATES, getTemplate } from "@/print/templates";
import type { FolderData } from "@/print/types";

/**
 * Half-fold folder generator.
 *
 * This page owns the *production* side of printing — sheet geometry in real
 * millimetres, bleed, crop marks, the `@page` rule and the CMYK step — and
 * delegates all layout to a template from `@/print/templates`. Templates are
 * interchangeable and never touch any of the above, so a new visual direction
 * is a new file, not a rewrite of this page.
 *
 * Sheet 1 (outside): [back cover | front cover] — Sheet 2 (inside): the spread.
 * Sizes are for the OPEN sheet; bleed is added around it and trimmed after printing.
 */
export default function PrintFolder() {
  // retryOnMount: false — the Router observes the same company-settings query;
  // a mount-triggered refetch while it is errored flips the Router back to its
  // loading state, unmounting this page and re-triggering the refetch forever.
  const settingsQuery = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
    retryOnMount: false,
  });
  const servicesQuery = useQuery<PortfolioService[]>({
    queryKey: ["/api/portfolio-services"],
    retryOnMount: false,
  });
  const settings = settingsQuery.data;
  const services = servicesQuery.data;

  const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE_ID);
  const [sheetW, setSheetW] = useState<number>(PAPER_PRESETS.a4.w);
  const [sheetH, setSheetH] = useState<number>(PAPER_PRESETS.a4.h);
  const [bleed, setBleed] = useState<number>(3);
  const [showCropMarks, setShowCropMarks] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<string[] | null>(null);

  const template = getTemplate(templateId);

  // Both catalogs, normalised into one list: the X-branded products from
  // `portfolio_services` and the services we perform from the homepage content.
  const catalog = useMemo(
    () => buildCatalog(services, settings?.homepageContent?.ourServicesSection?.cards),
    [services, settings?.homepageContent?.ourServicesSection?.cards],
  );

  // Default: everything. The spread devotes a whole panel to the apps and
  // another to the services, so the folder is meant to show the full line-up;
  // trimming it is the exception, done here in the sidebar.
  //
  // Wait for BOTH queries to settle before seeding. The two catalogs arrive from
  // separate endpoints, and seeding on whichever resolves first left the folder
  // opening with only services selected (or only products) depending on network
  // order, with no sign that anything was missing.
  const catalogsSettled = !settingsQuery.isPending && !servicesQuery.isPending;
  useEffect(() => {
    if (selectedKeys === null && catalogsSettled && catalog.length > 0) {
      setSelectedKeys(catalog.map((item) => item.key));
    }
  }, [catalog, catalogsSettled, selectedKeys]);

  // Selection order is irrelevant; catalog order is what prints. The two
  // catalogs stay apart because the inside spread gives each its own panel.
  const chosen = useMemo(
    () => catalog.filter((item) => (selectedKeys ?? []).includes(item.key)),
    [catalog, selectedKeys],
  );
  const chosenApps = useMemo(() => chosen.filter((i) => i.source === "product"), [chosen]);
  const chosenServices = useMemo(() => chosen.filter((i) => i.source === "service"), [chosen]);

  // Toolbar groups, so it is obvious which catalog an entry comes from.
  const groups = useMemo(() => {
    const order: FolderItemSource[] = ["product", "service"];
    return order
      .map((source) => ({ source, items: catalog.filter((i) => i.source === source) }))
      .filter((g) => g.items.length > 0);
  }, [catalog]);

  const siteUrl = settings?.seoCanonicalUrl || "https://skale.club";

  // One resolved brand object, so every template renders the same strings and
  // no template re-implements the logo/fallback rules.
  const folderData: FolderData = useMemo(() => {
    const socialLinks = Array.isArray(settings?.socialLinks)
      ? (settings!.socialLinks as { platform: string; url: string }[])
      : [];
    return {
      settings,
      apps: chosenApps,
      services: chosenServices,
      bleed,
      showPrices,
      brand: {
        name: settings?.companyName || "Skale Club",
        phone: settings?.companyPhone || "",
        email: settings?.companyEmail || "",
        address: settings?.companyAddress || "",
        siteUrl,
        siteLabel: siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
        logoOnDark: settings?.logoDark || settings?.logoMain || "",
        logoOnLight: settings?.logoMain || settings?.logoDark || "",
        heroTitle: settings?.heroTitle || "Stop Doing Repetitive Work. Automate It.",
        heroSubtitle:
          settings?.heroSubtitle ||
          "From AI chatbots to custom dashboards, we build the tech your business actually needs.",
        ctaText: settings?.ctaText || "Let's automate your business.",
        socialLinks,
      },
    };
  }, [settings, chosenApps, chosenServices, bleed, showPrices, siteUrl]);

  // Full page = open sheet + bleed on every side
  const pageW = sheetW + bleed * 2;
  const pageH = sheetH + bleed * 2;

  // Fit the mm-sized sheets to the preview column via CSS zoom (reset on print)
  const previewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => {
      const available = el.clientWidth - 32;
      setZoom(Math.min(1, available / (pageW * MM_TO_PX)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageW]);

  const handlePrint = () => {
    const previousTitle = document.title;
    document.title = `folder-${(settings?.companyName || "empresa").toLowerCase().replace(/\s+/g, "-")}`;
    window.print();
    document.title = previousTitle;
  };

  // Step 2 — native CMYK conversion of the saved PDF, in-browser via Ghostscript WASM
  const cmykInputRef = useRef<HTMLInputElement>(null);
  const [cmykState, setCmykState] = useState<"idle" | "converting" | "done" | "error">("idle");
  const [cmykError, setCmykError] = useState("");

  const handleCmykFile = async (file: File) => {
    setCmykState("converting");
    setCmykError("");
    try {
      const { convertPdfToCmyk } = await import("@/lib/cmykPdf");
      const input = new Uint8Array(await file.arrayBuffer());
      const output = await convertPdfToCmyk(input);
      const blob = new Blob([output as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${file.name.replace(/\.pdf$/i, "")}-cmyk.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setCmykState("done");
    } catch (err) {
      setCmykState("error");
      setCmykError((err as Error).message || "Falha na conversão");
    }
  };

  const toggleService = (key: string) => {
    setSelectedKeys((prev) => {
      const current = prev ?? [];
      return current.includes(key)
        ? current.filter((x) => x !== key)
        : [...current, key];
    });
  };

  const applyPreset = (key: PaperKey) => {
    setSheetW(PAPER_PRESETS[key].w);
    setSheetH(PAPER_PRESETS[key].h);
  };

  const sheetStyle: React.CSSProperties = {
    width: `${pageW}mm`,
    height: `${pageH}mm`,
  };

  return (
    <div className="min-h-screen bg-slate-200 text-slate-900" data-testid="print-folder-page">
      {/* Dynamic print setup for the chosen sheet size + bleed */}
      <style>{`
        @page { size: ${pageW}mm ${pageH}mm; margin: 0; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .print-zoom { zoom: 1 !important; }
          .screen-guide { display: none !important; }
          .print-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
            break-after: page;
          }
          .print-sheet:last-child { break-after: auto; }
          .print-preview-col { padding: 0 !important; }
          /* collapse screen-only layout so no empty trailing page is emitted */
          .min-h-screen { min-height: 0 !important; }
          .print-zoom { display: block !important; gap: 0 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="flex min-h-screen">
        {/* ============ Toolbar (screen only) ============ */}
        <aside className="no-print w-[300px] shrink-0 bg-white border-r border-slate-200 p-5 flex flex-col gap-5 sticky top-0 h-screen overflow-y-auto">
          <div>
            <h1 className="text-lg font-bold" style={{ color: INK.navy }}>
              Folder para impressão
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Panfleto de uma dobra (frente e verso). Clique em qualquer texto do
              folder para editá-lo antes de gerar o PDF.
            </p>
          </div>

          {/* ---- Template picker ---- */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <LayoutTemplate className="w-3.5 h-3.5" />
              Template
            </label>
            <div className="mt-2 flex flex-col gap-1.5">
              {FOLDER_TEMPLATES.map((t) => {
                const active = t.id === templateId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    data-testid={`button-template-${t.id}`}
                    className="text-left rounded-lg border px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-1"
                    style={{
                      borderColor: active ? INK.cta : "#E2E8F0",
                      backgroundColor: active ? "#EEF2FD" : "#fff",
                    }}
                  >
                    <span
                      className="block text-sm font-bold"
                      style={{ color: active ? INK.cta : INK.navy }}
                    >
                      {t.name}
                    </span>
                    <span className="block text-[11px] leading-snug text-slate-500 mt-0.5">
                      {t.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tamanho do papel
            </label>
            <div className="mt-2 flex flex-col gap-1.5">
              {(Object.keys(PAPER_PRESETS) as PaperKey[]).map((key) => {
                const preset = PAPER_PRESETS[key];
                const active = sheetW === preset.w && sheetH === preset.h;
                return (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    data-testid={`button-paper-${key}`}
                    className="text-left rounded-lg border px-3 py-2 text-sm transition-colors"
                    style={{
                      borderColor: active ? INK.cta : "#E2E8F0",
                      backgroundColor: active ? "#EEF2FD" : "#fff",
                      color: active ? INK.cta : INK.navy,
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sangria: {bleed} mm
            </label>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={bleed}
              onChange={(e) => setBleed(Number(e.target.value))}
              className="w-full mt-2 accent-blue-600"
              data-testid="input-bleed"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={showCropMarks}
                onChange={(e) => setShowCropMarks(e.target.checked)}
              />
              Marcas de corte
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={showPrices}
                onChange={(e) => setShowPrices(e.target.checked)}
              />
              Mostrar preços dos serviços
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={showGuides}
                onChange={(e) => setShowGuides(e.target.checked)}
              />
              Guias de dobra e corte na tela
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Serviços no folder
            </label>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Aplicativos ocupam a página 2, serviços a página 3.
            </p>
            <div className="mt-2 flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {groups.map((group) => (
                <div key={group.source}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-0.5">
                    {SOURCE_LABEL[group.source]}
                  </p>
                  {group.items.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-start gap-2 text-sm cursor-pointer rounded-md px-2 py-1.5 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-blue-600"
                        checked={(selectedKeys ?? []).includes(item.key)}
                        onChange={() => toggleService(item.key)}
                      />
                      <span className="leading-tight">{item.title}</span>
                    </label>
                  ))}
                </div>
              ))}
              {!catalogsSettled && (
                <p className="text-sm text-slate-400">Carregando serviços…</p>
              )}
              {catalogsSettled && catalog.length === 0 && (
                <p className="text-sm text-slate-400">Nenhum serviço ativo encontrado.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-white font-bold text-sm transition-colors"
              style={{ backgroundColor: INK.cta }}
              data-testid="button-print-pdf"
            >
              <Printer className="w-4 h-4" />
              1 · Baixar PDF
            </button>
            <button
              onClick={() => cmykInputRef.current?.click()}
              disabled={cmykState === "converting"}
              className="flex items-center justify-center gap-2 rounded-full px-5 py-3 font-bold text-sm border transition-colors disabled:opacity-60"
              style={{ borderColor: INK.navy, color: INK.navy }}
              data-testid="button-convert-cmyk"
            >
              {cmykState === "converting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Palette className="w-4 h-4" />
              )}
              {cmykState === "converting" ? "Convertendo…" : "2 · Converter para CMYK"}
            </button>
            <input
              ref={cmykInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              data-testid="input-cmyk-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCmykFile(file);
                e.target.value = "";
              }}
            />
            {cmykState === "done" && (
              <p className="text-xs text-emerald-600 text-center" data-testid="text-cmyk-done">
                PDF em CMYK baixado com sucesso.
              </p>
            )}
            {cmykState === "error" && (
              <p className="text-xs text-red-500 text-center" data-testid="text-cmyk-error">
                Erro na conversão: {cmykError}
              </p>
            )}
          </div>

          <div className="flex gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <strong>Passo 1:</strong> na janela que abrir, escolha{" "}
              <strong>“Salvar como PDF”</strong>, papel no tamanho exato mostrado, margens{" "}
              <strong>“Nenhuma”</strong> e sem cabeçalhos e rodapés.{" "}
              <strong>Passo 2:</strong> selecione o PDF salvo e ele será convertido para{" "}
              <strong>CMYK nativo</strong> (padrão de gráfica) aqui mesmo no navegador — na
              primeira vez o conversor (~16 MB) é baixado.
            </p>
          </div>
        </aside>

        {/* ============ Preview ============ */}
        <div ref={previewRef} className="print-preview-col flex-1 p-4 lg:p-8 overflow-x-hidden">
          <div className="print-zoom flex flex-col items-start gap-6" style={{ zoom }}>
            {/* ---------- Sheet 1: outside ---------- */}
            <div className="w-full no-print text-xs font-semibold uppercase tracking-widest text-slate-500">
              Lado externo — contracapa (esq.) e capa (dir.)
            </div>
            <div
              className="print-sheet relative shadow-xl overflow-hidden flex"
              style={{ ...sheetStyle, backgroundColor: template.sheetBackground.outside }}
              data-testid="sheet-outside"
            >
              <Guides bleed={bleed} show={showGuides} />
              {showCropMarks && <CropMarks bleed={bleed} />}
              <template.Outside {...folderData} />
            </div>

            {/* ---------- Sheet 2: inside spread ---------- */}
            <div className="w-full no-print text-xs font-semibold uppercase tracking-widest text-slate-500">
              Lado interno — portfólio de serviços
            </div>
            <div
              className="print-sheet relative shadow-xl overflow-hidden flex"
              style={{ ...sheetStyle, backgroundColor: template.sheetBackground.inside }}
              data-testid="sheet-inside"
            >
              <Guides bleed={bleed} show={showGuides} />
              {showCropMarks && <CropMarks bleed={bleed} />}
              <template.Inside {...folderData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
