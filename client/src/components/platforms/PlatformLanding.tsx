import { useState } from "react";
import { ArrowUpRight, Check, Globe2, Layers3 } from "lucide-react";
import type { CatalogItem } from "@shared/catalog";
import { withLanguage } from "@shared/languagePath";
import { platformSlug, safePlatformUrl } from "@shared/platforms";
import { getPlatformLanding } from "@shared/platformLandings";

const labels = {
  en: { benefits: "What you can do", access: "Open platform", contact: "Talk to us", by: "By Skale Club", platforms: "All platforms" },
  pt: { benefits: "O que você pode fazer", access: "Acessar plataforma", contact: "Fale conosco", by: "Por Skale Club", platforms: "Todas as plataformas" },
} as const;

function bounded(value: string | undefined, max: number, fallback: string): string {
  const text = (value?.trim() || fallback).replace(/\s+/g, " ");
  if (text.length <= max) return text;
  const clipped = text.slice(0, max).replace(/\s+\S*$/, "").trim();
  return clipped || text.slice(0, max).trim();
}

export function PlatformLanding({ item, language }: { item: CatalogItem; language: "en" | "pt" }) {
  const friendlySlug = platformSlug(item.slug ?? "") ?? "";
  const editorial = getPlatformLanding(friendlySlug, language);
  const [logoFailed, setLogoFailed] = useState(false);
  const title = editorial?.name ?? bounded(item.title, 40, language === "pt" ? "Plataforma" : "Platform");
  const eyebrow = editorial?.eyebrow ?? (language === "pt" ? "Plataforma Skale Club" : "Skale Club platform");
  const headline = editorial?.headline ?? bounded(item.subtitle, 70, title);
  const intro = editorial?.intro ?? bounded(item.description, 200, item.subtitle ?? title);
  const rawBenefits = editorial?.benefits ?? item.features.slice(0, 3);
  const benefits = [0, 1, 2].map((index) => bounded(rawBenefits[index], 100, index === 0 ? title : intro));
  const isContact = editorial?.ctaKind === "contact";
  const href = isContact ? withLanguage("/contact", language) : safePlatformUrl(item.site);
  const text = labels[language];

  return (
    <article className="bg-navy-950 text-fog-50">
      <section className="container-custom mx-auto grid max-w-6xl items-center gap-9 px-4 pb-14 pt-[calc(var(--nav-offset,5rem)+2rem)] sm:px-6 md:grid-cols-[1.1fr_.9fr] md:gap-16 md:pb-20 md:pt-[calc(var(--nav-offset,5rem)+3rem)]">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-blue-200"><Globe2 aria-hidden="true" className="h-3.5 w-3.5" />{eyebrow}</p>
          <p className="text-sm font-semibold tracking-wide text-fog-300">{title}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.04] tracking-[-0.025em] sm:text-5xl lg:text-6xl">{headline}</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-fog-300">{intro}</p>
          {href && <a href={href} target={isContact ? undefined : "_blank"} rel={isContact ? undefined : "noreferrer"} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-cta-hover px-6 py-3 font-semibold text-white transition hover:brightness-110" data-testid="platform-primary-cta">{isContact ? text.contact : text.access}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>}
        </div>
        <div className="relative mx-auto flex aspect-square w-44 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-500/20 via-blue-500/5 to-navy-950 p-7 shadow-[0_28px_80px_rgba(0,0,0,.38)] sm:w-56 md:w-full md:max-w-[18rem]">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,.08),transparent_55%)]" />
          {item.logo && !logoFailed ? <img src={item.logo} alt="" className="relative max-h-full max-w-full object-contain" onError={() => setLogoFailed(true)} /> : <span aria-hidden="true" className="relative font-display text-7xl font-semibold text-blue-200">{title.slice(0, 1).toUpperCase()}</span>}
        </div>
      </section>
      <section className="border-y border-white/10 bg-navy-900/70">
        <div className="container-custom mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-12">
          <h2 className="font-display text-xl font-semibold text-fog-100">{labels[language].benefits}</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {benefits.map((benefit, index) => <li key={`${index}-${benefit}`} className="flex items-start gap-3 text-sm leading-6 text-fog-300"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-300/10 text-blue-200"><Check aria-hidden="true" className="h-3.5 w-3.5" /></span>{benefit}</li>)}
          </ul>
        </div>
      </section>
      <footer className="container-custom mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-6">
        <a href={withLanguage("/", language)} className="font-medium text-fog-400 transition hover:text-fog-100">{text.by}</a>
        <a href={withLanguage("/apps", language)} className="inline-flex items-center gap-1 font-semibold text-fog-200 transition hover:text-white" data-testid="platforms-back-link">{text.platforms}<Layers3 aria-hidden="true" className="h-4 w-4" /></a>
      </footer>
    </article>
  );
}
