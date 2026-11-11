import { useState } from "react";
import { AppWindow, AudioLines, Check, Download, Gauge, Monitor, PenTool, Repeat2, SlidersHorizontal, ArrowUpRight } from "lucide-react";
import type { PublicDownloadableApp } from "@shared/schema/downloads";
import { appDownloadPath } from "@shared/downloads";
import { withLanguage } from "@shared/languagePath";
import type { AppLandingContent, AppLandingLanguage } from "@shared/appLandings";
import { getAppLanding } from "@shared/appLandings";

const accents = {
  blue: { glow: "from-blue-500/25 via-blue-500/5", icon: "text-blue-300", chip: "border-blue-300/20 bg-blue-300/10 text-blue-200" },
  violet: { glow: "from-violet-500/25 via-violet-500/5", icon: "text-violet-300", chip: "border-violet-300/20 bg-violet-300/10 text-violet-200" },
  green: { glow: "from-emerald-500/25 via-emerald-500/5", icon: "text-emerald-300", chip: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" },
  cyan: { glow: "from-cyan-500/25 via-cyan-500/5", icon: "text-cyan-300", chip: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200" },
  orange: { glow: "from-orange-500/25 via-orange-500/5", icon: "text-orange-300", chip: "border-orange-300/20 bg-orange-300/10 text-orange-200" },
  slate: { glow: "from-slate-400/20 via-slate-400/5", icon: "text-slate-200", chip: "border-slate-200/20 bg-slate-200/10 text-slate-100" },
} as const;

const productIcons = {
  xnote: AudioLines,
  xink: PenTool,
  xvert: Repeat2,
  xpace: Gauge,
  xdeck: SlidersHorizontal,
  xtation: AppWindow,
} as const;

const labels = {
  en: { free: "Free", windows: "Windows app", benefits: "At a glance", downloads: "Downloads", download: "Download", version: "Version", windowsX64: "Windows · x64", installer: "Installer", portable: "Portable app", youtube: "YouTube desktop app", youtubeMusic: "YouTube Music desktop app", homeAssistant: "Home Assistant desktop app", noReleases: "Downloads are not available right now.", allApps: "All apps", bySkale: "By Skale Club" },
  pt: { free: "Grátis", windows: "App para Windows", benefits: "Em resumo", downloads: "Downloads", download: "Baixar", version: "Versão", windowsX64: "Windows · x64", installer: "Instalador", portable: "App portátil", youtube: "App de desktop do YouTube", youtubeMusic: "App de desktop do YouTube Music", homeAssistant: "App de desktop do Home Assistant", noReleases: "Downloads indisponíveis no momento.", allApps: "Todos os apps", bySkale: "Por Skale Club" },
} satisfies Record<AppLandingLanguage, Record<string, string>>;

function releaseLabel(app: PublicDownloadableApp, release: PublicDownloadableApp["releases"][number], language: AppLandingLanguage) {
  const text = labels[language];
  const id = release.id.toLowerCase();
  if (app.slug === "xtation") {
    if (id.includes("youtube-music")) return text.youtubeMusic;
    if (id.includes("home-assistant")) return text.homeAssistant;
    if (id.includes("youtube")) return text.youtube;
  }
  if (id.includes("setup")) return text.installer;
  if (id.includes("portable")) return text.portable;
  return platformName(release.platform);
}

function ProductMark({ slug, name, accent }: { slug: string; name: string; accent: keyof typeof accents }) {
  const [failed, setFailed] = useState(false);
  const FallbackIcon = productIcons[slug as keyof typeof productIcons] ?? Monitor;
  return (
    <div className={`relative flex aspect-square w-40 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${accents[accent].glow} to-navy-950 p-6 shadow-[0_28px_80px_rgba(0,0,0,.38)] sm:w-56 sm:p-8 md:w-full md:max-w-[18rem]`}>
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,.08),transparent_55%)]" />
      {slug === "xtation" ? (
        <div className="relative flex flex-col items-center gap-3 sm:gap-5">
          <AppWindow aria-hidden="true" className={`h-12 w-12 sm:h-20 sm:w-20 ${accents[accent].icon}`} strokeWidth={1.25} />
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/apps/xtation/youtube.svg" alt="YouTube" className="h-6 w-6 object-contain sm:h-8 sm:w-8" />
            <img src="/apps/xtation/youtube-music.svg" alt="YouTube Music" className="h-6 w-6 object-contain sm:h-8 sm:w-8" />
            <img src="/apps/xtation/home-assistant.svg" alt="Home Assistant" className="h-6 w-6 object-contain sm:h-8 sm:w-8" />
          </div>
        </div>
      ) : !failed ? (
        <img src={`/apps/${slug}/logo.png`} alt={`${name} logo`} className="relative max-h-full max-w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <div className="relative">
          <FallbackIcon aria-hidden="true" className={`h-16 w-16 sm:h-24 sm:w-24 ${accents[accent].icon}`} strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}

export function AppLanding({ app, language }: { app: PublicDownloadableApp; language: AppLandingLanguage }) {
  const content: AppLandingContent = getAppLanding(app.slug, language) ?? genericLanding(app, language);
  const accent = accents[content.brandAccent];
  const Icon = productIcons[content.slug as keyof typeof productIcons] ?? Monitor;
  const visibleReleases = app.releases.filter((release) => release.isPublished);
  const copy = labels[language];
  const platforms = [...new Set(visibleReleases.map((release) => platformName(release.platform)))].join(" / ");
  const platformBadge = platforms ? (language === "pt" ? `App para ${platforms}` : `${platforms} app`) : (language === "pt" ? "Aplicativo" : "App");

  return (
    <article className="bg-navy-950 text-fog-50">
      <section className="container-custom mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-[calc(var(--nav-offset,5rem)+2rem)] sm:px-6 md:grid-cols-[1.1fr_.9fr] md:gap-16 md:pb-20 md:pt-[calc(var(--nav-offset,5rem)+3rem)]">
        <div className="max-w-2xl">
          <p className={`mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] ${accent.chip}`}><Monitor aria-hidden="true" className="h-3.5 w-3.5" />{platformBadge} <span aria-hidden="true">·</span> {copy.free}</p>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm tracking-wide text-fog-300"><span className="font-display text-lg font-semibold text-fog-50">{content.name}</span><span>{content.eyebrow}</span></p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.04] tracking-[-0.025em] sm:text-5xl lg:text-6xl">{content.headline}</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-fog-300">{content.intro}</p>
          <a href="#app-downloads" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-cta-hover px-6 py-3 font-semibold text-white transition hover:brightness-110" data-testid="app-landing-primary-download">{copy.download} {content.name}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>
        </div>
        <div className="flex justify-center md:justify-end" data-testid="app-landing-identity">
          <ProductMark key={content.slug} slug={content.slug} name={content.name} accent={content.brandAccent} />
        </div>
      </section>

      <section className="border-y border-white/10 bg-navy-900/70">
        <div className="container-custom mx-auto max-w-6xl px-4 py-9 sm:px-6 md:py-12">
          <h2 className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-fog-400"><Icon aria-hidden="true" className={`h-4 w-4 ${accent.icon}`} />{copy.benefits}</h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {content.benefits.map((benefit) => <li key={benefit} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-navy-950/70 p-5 text-base font-medium leading-6 text-fog-100"><Check aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${accent.icon}`} />{benefit}</li>)}
          </ul>
          {content.essentials && <p className="mt-5 max-w-4xl text-sm leading-6 text-fog-400" data-testid="app-landing-essential">{content.essentials}</p>}
        </div>
      </section>

      <section id="app-downloads" className="container-custom mx-auto max-w-6xl scroll-mt-24 px-4 py-12 sm:px-6 md:py-16">
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-fog-400">{content.name}</p><h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{copy.downloads}</h2></div><span className={`rounded-full border px-3 py-1 text-sm font-semibold ${accent.chip}`}>{copy.free}</span></div>
        {visibleReleases.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-fog-400" data-testid="app-landing-no-releases">{copy.noReleases}</p> : <ul className="grid gap-3 sm:grid-cols-2">
          {visibleReleases.map((release) => {
            const label = releaseLabel(app, release, language);
            const variantIcon = content.slug === "xtation" ? xtationMark(release.id) : undefined;
            return <li key={release.id} className="grid gap-4 rounded-2xl border border-white/10 bg-navy-900 p-5 sm:grid-cols-[1fr_auto] sm:items-center" data-testid="app-landing-release">
              <div className="flex min-w-0 items-center gap-3">
                {variantIcon ? <img src={variantIcon.src} alt="" aria-hidden="true" className="h-9 w-9 object-contain" /> : <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent.chip}`}><Download aria-hidden="true" className="h-5 w-5" /></span>}
                <div className="min-w-0"><h3 className="font-semibold text-fog-50">{label}</h3><p className="mt-1 text-sm text-fog-400">{copy.version} {release.version} · {platformName(release.platform)} · {architectureName(release.architecture)}</p></div>
              </div>
              <a href={appDownloadPath(app.slug, release.id)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-fog-50 transition hover:border-white/30 hover:bg-white/5" data-testid="app-landing-download">{copy.download}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>
            </li>;
          })}
        </ul>}
      </section>

      <footer className="border-t border-white/10 bg-navy-900/70">
        <div className="container-custom mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-fog-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <a href={withLanguage("/", language)} className="font-medium text-fog-400 transition hover:text-fog-100">{copy.bySkale}</a><a href={withLanguage("/downloads", language)} className="inline-flex items-center gap-1 font-semibold text-fog-200 transition hover:text-white" data-testid="app-landing-all-apps">{copy.allApps}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>
        </div>
      </footer>
    </article>
  );
}

function xtationMark(id: string): { src: string } | undefined {
  const lower = id.toLowerCase();
  if (lower.includes("youtube-music")) return { src: "/apps/xtation/youtube-music.svg" };
  if (lower.includes("home-assistant")) return { src: "/apps/xtation/home-assistant.svg" };
  if (lower.includes("youtube")) return { src: "/apps/xtation/youtube.svg" };
  return undefined;
}

function platformName(platform: string): string {
  const names: Record<string, string> = { windows: "Windows", macos: "macOS", linux: "Linux", android: "Android", ios: "iOS" };
  return names[platform] ?? platform;
}

function architectureName(architecture: string): string {
  const names: Record<string, string> = { x64: "x64", arm64: "ARM64", universal: "Universal" };
  return names[architecture] ?? architecture;
}

function genericLanding(app: PublicDownloadableApp, language: AppLandingLanguage): AppLandingContent {
  const fallbackBenefits = language === "pt"
    ? ["Aplicativo gratuito", "Veja os detalhes do aplicativo", "Baixe uma versão disponível"]
    : ["Free app", "See what the application does", "Download an available release"];
  const benefits = [...(app.features ?? []).slice(0, 3)].map((feature) => concise(feature, 100));
  while (benefits.length < 3) benefits.push(fallbackBenefits[benefits.length]);
  const intro = concise(app.description?.trim() || app.tagline, 200);
  return {
    slug: app.slug,
    name: app.name,
    eyebrow: language === "pt" ? "Ferramentas para o dia a dia" : "Tools for everyday work",
    headline: concise(app.tagline?.trim() || app.name, 70),
    intro,
    benefits: benefits as [string, string, string],
    seo: {
      title: `${app.name} | ${language === "pt" ? "Aplicativo" : "App"}`,
      description: concise(app.tagline?.trim() || intro, 160),
    },
    brandAccent: "blue",
  };
}

function concise(value: string, limit: number): string {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length <= limit) return text;
  const prefix = text.slice(0, limit - 1);
  const boundary = prefix.lastIndexOf(" ");
  return `${boundary > limit / 2 ? prefix.slice(0, boundary) : prefix}…`;
}
