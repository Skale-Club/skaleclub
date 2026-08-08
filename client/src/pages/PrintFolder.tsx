import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import { Printer, Phone, Mail, MapPin, Globe, Check, Info, Loader2, Palette } from "lucide-react";
import type { CompanySettings, PortfolioService } from "@shared/schema";

// Half-fold folder: one landscape sheet, folded once vertically.
// Sheet 1 (outside): [back cover | front cover] — Sheet 2 (inside): services spread.
// Sizes are for the OPEN sheet; bleed is added around it and trimmed after printing.
const PAPER_PRESETS = {
  a4: { label: "A4 aberto · 29,7 × 21 cm", w: 297, h: 210 },
  letter: { label: "Carta aberto · 27,9 × 21,6 cm", w: 279.4, h: 215.9 },
} as const;

const MM_TO_PX = 96 / 25.4;
const NAVY = "#0A162E";
const ACTION_BLUE = "#5173D6";
const CONTENT_PAD_MM = 10; // safe margin between trim edge and content

// Free-text blocks are contentEditable so copy can be tweaked before printing —
// edits live only until the page reloads.
function Editable({
  as: Tag = "div",
  className,
  style,
  children,
}: {
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const T = Tag as any;
  return (
    <T
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className={`outline-none focus:ring-1 focus:ring-blue-400/60 rounded-sm ${className ?? ""}`}
      style={style}
    >
      {children}
    </T>
  );
}

// Trim/crop marks at the 4 corners of the trim box (printed, standard prepress marks)
function CropMarks({ bleed }: { bleed: number }) {
  if (bleed <= 0) return null;
  const len = Math.max(bleed - 1, 2);
  const mark = (style: React.CSSProperties) => (
    <div className="absolute bg-black" style={style} />
  );
  const mm = (v: number) => `${v}mm`;
  return (
    <>
      {/* top-left */}
      {mark({ top: 0, left: mm(bleed), width: "0.3mm", height: mm(len) })}
      {mark({ top: mm(bleed), left: 0, height: "0.3mm", width: mm(len) })}
      {/* top-right */}
      {mark({ top: 0, right: mm(bleed), width: "0.3mm", height: mm(len) })}
      {mark({ top: mm(bleed), right: 0, height: "0.3mm", width: mm(len) })}
      {/* bottom-left */}
      {mark({ bottom: 0, left: mm(bleed), width: "0.3mm", height: mm(len) })}
      {mark({ bottom: mm(bleed), left: 0, height: "0.3mm", width: mm(len) })}
      {/* bottom-right */}
      {mark({ bottom: 0, right: mm(bleed), width: "0.3mm", height: mm(len) })}
      {mark({ bottom: mm(bleed), right: 0, height: "0.3mm", width: mm(len) })}
    </>
  );
}

export default function PrintFolder() {
  // retryOnMount: false — the Router observes the same company-settings query;
  // a mount-triggered refetch while it is errored flips the Router back to its
  // loading state, unmounting this page and re-triggering the refetch forever.
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
    retryOnMount: false,
  });
  const { data: services } = useQuery<PortfolioService[]>({
    queryKey: ["/api/portfolio-services"],
    retryOnMount: false,
  });

  const [sheetW, setSheetW] = useState<number>(PAPER_PRESETS.a4.w);
  const [sheetH, setSheetH] = useState<number>(PAPER_PRESETS.a4.h);
  const [bleed, setBleed] = useState<number>(3);
  const [showCropMarks, setShowCropMarks] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[] | null>(null);

  const activeServices = useMemo(
    () => (services ?? []).filter((s) => s.isActive),
    [services],
  );

  // Default: the first 6 active services (what comfortably fits the inside spread)
  useEffect(() => {
    if (selectedIds === null && activeServices.length > 0) {
      setSelectedIds(activeServices.slice(0, 6).map((s) => s.id));
    }
  }, [activeServices, selectedIds]);

  const chosenServices = useMemo(
    () => activeServices.filter((s) => (selectedIds ?? []).includes(s.id)),
    [activeServices, selectedIds],
  );
  // Inside spread: split services across the two panels (intro sits on the left)
  const leftCount = Math.floor(chosenServices.length / 2);
  const leftServices = chosenServices.slice(0, leftCount);
  const rightServices = chosenServices.slice(leftCount);

  const homepage = settings?.homepageContent ?? {};
  const about = homepage.aboutSection ?? {};
  const socialLinks = Array.isArray(settings?.socialLinks)
    ? (settings!.socialLinks as { platform: string; url: string }[])
    : [];
  const siteUrl = settings?.seoCanonicalUrl || "https://skale.club";
  const siteLabel = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const logoLight = settings?.logoDark || settings?.logoMain || "";
  const logoDarkOnLight = settings?.logoMain || settings?.logoDark || "";

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

  const toggleService = (id: number) => {
    setSelectedIds((prev) => {
      const current = prev ?? [];
      return current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
    });
  };

  const applyPreset = (key: keyof typeof PAPER_PRESETS) => {
    setSheetW(PAPER_PRESETS[key].w);
    setSheetH(PAPER_PRESETS[key].h);
  };

  const sheetStyle: React.CSSProperties = {
    width: `${pageW}mm`,
    height: `${pageH}mm`,
  };

  // Content padding per panel: safe margin from the TRIM edge; outer edges also
  // absorb the bleed so nothing important is cut when the sheet is trimmed.
  const padOuter = `${CONTENT_PAD_MM + bleed}mm`;
  const padFold = `${CONTENT_PAD_MM}mm`;
  const leftPanelPad: React.CSSProperties = {
    paddingTop: padOuter,
    paddingBottom: padOuter,
    paddingLeft: padOuter,
    paddingRight: padFold,
  };
  const rightPanelPad: React.CSSProperties = {
    paddingTop: padOuter,
    paddingBottom: padOuter,
    paddingLeft: padFold,
    paddingRight: padOuter,
  };

  const guides = showGuides && (
    <>
      {/* fold line (screen only) */}
      <div className="screen-guide absolute inset-y-0 left-1/2 w-0 border-l border-dashed border-slate-400/70 pointer-events-none z-10">
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-slate-400 whitespace-nowrap">
          dobra
        </span>
      </div>
      {/* trim box (screen only) */}
      {bleed > 0 && (
        <div
          className="screen-guide absolute border border-dashed border-red-400/60 pointer-events-none z-10"
          style={{ inset: `${bleed}mm` }}
        />
      )}
    </>
  );

  const serviceCard = (s: PortfolioService) => (
    <div key={s.id} className="bg-white rounded-lg border border-slate-200 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <Editable className="text-[10.5pt] font-bold" style={{ color: NAVY }}>
          {s.title}
        </Editable>
        {showPrices && (
          <Editable
            className="text-[10pt] font-extrabold whitespace-nowrap"
            style={{ color: ACTION_BLUE }}
          >
            {s.price}
          </Editable>
        )}
      </div>
      <Editable className="mt-0.5 text-[8.5pt] text-slate-500 leading-snug">
        {s.subtitle}
      </Editable>
      {(s.features ?? []).length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {(s.features ?? []).slice(0, 3).map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[8pt] text-slate-600">
              <Check
                className="w-3 h-3 shrink-0 mt-[1px]"
                style={{ color: ACTION_BLUE }}
              />
              <Editable>{f}</Editable>
            </div>
          ))}
        </div>
      )}
    </div>
  );

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
            <h1 className="text-lg font-bold" style={{ color: NAVY }}>
              Folder para impressão
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Panfleto de uma dobra (frente e verso). Clique em qualquer texto do
              folder para editá-lo antes de gerar o PDF.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tamanho da lâmina aberta
            </label>
            <div className="mt-2 flex gap-1.5">
              {(Object.keys(PAPER_PRESETS) as (keyof typeof PAPER_PRESETS)[]).map((key) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                    sheetW === PAPER_PRESETS[key].w && sheetH === PAPER_PRESETS[key].h
                      ? "border-blue-500 bg-blue-50 font-semibold"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {key === "a4" ? "A4" : "Carta"}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="number"
                min={100}
                max={600}
                step={0.1}
                value={sheetW}
                onChange={(e) => setSheetW(Number(e.target.value) || 100)}
                className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-2 py-1.5"
              />
              <span className="text-slate-400">×</span>
              <input
                type="number"
                min={100}
                max={600}
                step={0.1}
                value={sheetH}
                onChange={(e) => setSheetH(Number(e.target.value) || 100)}
                className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-2 py-1.5"
              />
              <span className="text-slate-500 text-xs">mm</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Largura × altura da folha aberta (antes da dobra).
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sangria
            </label>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={bleed}
                onChange={(e) => setBleed(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 rounded-lg border border-slate-200 bg-white text-slate-900 px-2 py-1.5"
              />
              <span className="text-slate-500 text-xs">mm em cada borda</span>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={showCropMarks}
                onChange={(e) => setShowCropMarks(e.target.checked)}
                disabled={bleed <= 0}
              />
              Imprimir marcas de corte
            </label>
          </div>

          <div className="flex flex-col gap-2">
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
            <div className="mt-2 flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
              {activeServices.map((s) => (
                <label
                  key={s.id}
                  className="flex items-start gap-2 text-sm cursor-pointer rounded-md px-2 py-1.5 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-blue-600"
                    checked={(selectedIds ?? []).includes(s.id)}
                    onChange={() => toggleService(s.id)}
                  />
                  <span className="leading-tight">{s.title}</span>
                </label>
              ))}
              {activeServices.length === 0 && (
                <p className="text-sm text-slate-400">Carregando serviços…</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-white font-bold text-sm transition-colors"
              style={{ backgroundColor: ACTION_BLUE }}
              data-testid="button-print-pdf"
            >
              <Printer className="w-4 h-4" />
              1 · Baixar PDF
            </button>
            <button
              onClick={() => cmykInputRef.current?.click()}
              disabled={cmykState === "converting"}
              className="flex items-center justify-center gap-2 rounded-full px-5 py-3 font-bold text-sm border transition-colors disabled:opacity-60"
              style={{ borderColor: NAVY, color: NAVY }}
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
            {/* ---------- Sheet 1: outside (back cover | front cover) ---------- */}
            <div className="w-full no-print text-xs font-semibold uppercase tracking-widest text-slate-500">
              Lado externo — contracapa (esq.) e capa (dir.)
            </div>
            <div
              className="print-sheet relative bg-white shadow-xl overflow-hidden flex"
              style={sheetStyle}
            >
              {guides}
              {showCropMarks && <CropMarks bleed={bleed} />}

              {/* Back cover: contact */}
              <div className="w-1/2 h-full flex flex-col" style={leftPanelPad}>
                <Editable
                  as="h2"
                  className="text-[22pt] font-extrabold leading-tight"
                  style={{ color: NAVY }}
                >
                  Vamos conversar?
                </Editable>
                <Editable className="mt-2 text-[11pt] text-slate-500">
                  Fale com a gente e descubra como podemos ajudar o seu negócio a
                  crescer.
                </Editable>

                <div className="mt-6 flex flex-col gap-3 text-[11pt]" style={{ color: NAVY }}>
                  {settings?.companyPhone && (
                    <div className="flex items-center gap-3">
                      <span
                        className="flex items-center justify-center w-8 h-8 rounded-full text-white shrink-0"
                        style={{ backgroundColor: ACTION_BLUE }}
                      >
                        <Phone className="w-4 h-4" />
                      </span>
                      <Editable>{settings.companyPhone}</Editable>
                    </div>
                  )}
                  {settings?.companyEmail && (
                    <div className="flex items-center gap-3">
                      <span
                        className="flex items-center justify-center w-8 h-8 rounded-full text-white shrink-0"
                        style={{ backgroundColor: ACTION_BLUE }}
                      >
                        <Mail className="w-4 h-4" />
                      </span>
                      <Editable>{settings.companyEmail}</Editable>
                    </div>
                  )}
                  {settings?.companyAddress && (
                    <div className="flex items-center gap-3">
                      <span
                        className="flex items-center justify-center w-8 h-8 rounded-full text-white shrink-0"
                        style={{ backgroundColor: ACTION_BLUE }}
                      >
                        <MapPin className="w-4 h-4" />
                      </span>
                      <Editable>{settings.companyAddress}</Editable>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span
                      className="flex items-center justify-center w-8 h-8 rounded-full text-white shrink-0"
                      style={{ backgroundColor: ACTION_BLUE }}
                    >
                      <Globe className="w-4 h-4" />
                    </span>
                    <Editable>{siteLabel}</Editable>
                  </div>
                </div>

                {socialLinks.length > 0 && (
                  <div className="mt-5 text-[9pt] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                    {socialLinks.map((link, i) => (
                      <span key={i} className="capitalize">
                        {link.platform}: {link.url.replace(/^https?:\/\/(www\.)?/, "")}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex items-end justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="bg-white p-2 border border-slate-200 rounded-md w-fit">
                      <QRCode value={siteUrl} size={68} />
                    </div>
                    <Editable className="text-[8pt] text-slate-500">
                      Aponte a câmera e acesse nosso site
                    </Editable>
                  </div>
                  {logoDarkOnLight && (
                    <img
                      src={logoDarkOnLight}
                      alt={settings?.companyName || ""}
                      className="h-8 object-contain"
                    />
                  )}
                </div>
              </div>

              {/* Front cover: company presentation */}
              <div
                className="w-1/2 h-full flex flex-col text-white relative"
                style={{ ...rightPanelPad, backgroundColor: NAVY }}
              >
                <div
                  className="absolute top-0 left-0 right-0"
                  style={{ height: `${4 + bleed}mm`, backgroundColor: ACTION_BLUE }}
                />
                {logoLight ? (
                  <img
                    src={logoLight}
                    alt={settings?.companyName || ""}
                    className="h-10 object-contain self-start mt-4 relative"
                  />
                ) : (
                  <div className="text-[16pt] font-extrabold mt-4 relative">
                    {settings?.companyName}
                  </div>
                )}

                <div className="my-auto">
                  <Editable as="h1" className="text-[26pt] font-extrabold leading-[1.15]">
                    {settings?.heroTitle || "Sua empresa de marketing 5 estrelas"}
                  </Editable>
                  <div
                    className="mt-4 h-[1.5mm] w-[28mm] rounded-full"
                    style={{ backgroundColor: ACTION_BLUE }}
                  />
                  <Editable className="mt-4 text-[12pt] text-slate-300 leading-relaxed">
                    {settings?.heroSubtitle ||
                      "Marketing orientado por dados e soluções escaláveis de crescimento."}
                  </Editable>
                </div>

                <div className="mt-auto flex items-center justify-between text-[10pt] text-slate-300">
                  <span>{siteLabel}</span>
                  {settings?.companyPhone && <span>{settings.companyPhone}</span>}
                </div>
              </div>
            </div>

            {/* ---------- Sheet 2: inside spread (portfolio / services) ---------- */}
            <div className="w-full no-print text-xs font-semibold uppercase tracking-widest text-slate-500">
              Lado interno — portfólio de serviços
            </div>
            <div
              className="print-sheet relative shadow-xl overflow-hidden flex"
              style={{ ...sheetStyle, backgroundColor: "#F8FAFC" }}
            >
              {guides}
              {showCropMarks && <CropMarks bleed={bleed} />}

              {/* Inside left: intro + first services */}
              <div className="w-1/2 h-full flex flex-col" style={leftPanelPad}>
                <Editable
                  className="text-[10pt] font-bold uppercase tracking-widest"
                  style={{ color: ACTION_BLUE }}
                >
                  {about.label || "Nossos serviços"}
                </Editable>
                <Editable
                  as="h2"
                  className="mt-1.5 text-[17pt] font-extrabold leading-tight"
                  style={{ color: NAVY }}
                >
                  Soluções para o seu negócio crescer
                </Editable>
                <Editable className="mt-2 text-[9.5pt] text-slate-600 leading-relaxed">
                  {about.description ||
                    "Conheça nosso portfólio de serviços: soluções sob medida, orientadas por dados e prontas para escalar com a sua empresa."}
                </Editable>

                <div className="mt-4 flex flex-col gap-2.5 overflow-hidden">
                  {leftServices.map(serviceCard)}
                </div>

                <div
                  className="mt-auto rounded-lg px-4 py-2.5 text-white text-[9.5pt] font-semibold text-center"
                  style={{ backgroundColor: NAVY }}
                >
                  <Editable>
                    {settings?.ctaText || "Fale conosco"} ·{" "}
                    {settings?.companyPhone || siteLabel}
                  </Editable>
                </div>
              </div>

              {/* Inside right: remaining services */}
              <div className="w-1/2 h-full flex flex-col" style={rightPanelPad}>
                <div className="flex flex-col gap-2.5 overflow-hidden">
                  {rightServices.map(serviceCard)}
                  {chosenServices.length === 0 && (
                    <p className="text-[10pt] text-slate-400">
                      Selecione serviços na barra lateral.
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-3 flex items-center justify-between text-[9pt] text-slate-500">
                  <span>{siteLabel}</span>
                  {logoDarkOnLight && (
                    <img src={logoDarkOnLight} alt="" className="h-6 object-contain opacity-80" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
