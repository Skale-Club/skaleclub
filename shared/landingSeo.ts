import { splitLanguagePath, withLanguage } from "./languagePath.js";

// Single source of truth for managed-landing-page SEO metadata (title, description,
// locale) plus the slug <-> path mapping shared by the server-side crawler injection
// (server/static.ts) and the client-side post-hydration SEO effect
// (client/src/pages/DynamicLanding.tsx). Keyed by DB slug (e.g. "nfc-keychains-br"),
// not by URL path — a managed bilingual pair stores single-segment slugs (`x` and
// `x-br`), but the PT member's canonical public URL is the `/br/x` prefix form.

export type LandingLocale = "en_US" | "pt_BR";

export interface LandingSeo {
  title: string;
  description: string;
  locale: LandingLocale;
}

export const LANDING_SEO: Record<string, LandingSeo> = {
  "nfc-keychains": {
    title: "Custom NFC Keychains for Businesses | Skale Club",
    description:
      "Custom 3D-printed NFC keychains that open your reviews, Instagram, menu, digital card, or website with one tap.",
    locale: "en_US",
  },
  "nfc-keychains-br": {
    title: "Chaveiros NFC Personalizados para Empresas | Skale Club",
    description:
      "Chaveiros NFC personalizados e impressos em 3D para abrir avaliações, Instagram, cardápio, cartão digital ou site com um toque.",
    locale: "pt_BR",
  },
  "nfc-order": {
    title: "Order Custom NFC Keychains | Skale Club",
    description:
      "Order custom 3D-printed NFC keychains: pick your quantity, see the price as you choose, and send your logo. We confirm every detail before production.",
    locale: "en_US",
  },
  "nfc-order-br": {
    title: "Peça seus Chaveiros NFC Personalizados | Skale Club",
    description:
      "Peça chaveiros NFC personalizados e impressos em 3D: escolha a quantidade, veja o preço na hora e envie sua logo. Confirmamos cada detalhe antes de produzir.",
    locale: "pt_BR",
  },
  "nfc-pricing": {
    title: "NFC Keychain Pricing and Instructions | Skale Club",
    description:
      "See NFC keychain pricing, minimum order, setup process, compatible phones, and answers to common questions.",
    locale: "en_US",
  },
  "nfc-pricing-br": {
    title: "Preços e Instruções dos Chaveiros NFC | Skale Club",
    description:
      "Veja preços, pedido mínimo, processo de produção, celulares compatíveis e respostas sobre os chaveiros NFC.",
    locale: "pt_BR",
  },
  websites: {
    title: "Websites for Service Businesses | Skale Club",
    description:
      "Fast, Google-optimized websites for service businesses, deployed in days. Tell us about your project and get a proposal within 24 hours.",
    locale: "en_US",
  },
  "websites-br": {
    title: "Sites para Empresas de Serviços | Skale Club",
    description:
      "Sites rápidos e otimizados para o Google para empresas de serviços, no ar em dias. Conte sobre seu projeto e receba uma proposta em até 24 horas.",
    locale: "pt_BR",
  },
  barbershops: {
    title: "Marketing for Barbershops | Skale Club",
    description:
      "Get more clients for your barbershop with websites, Google reviews, and booking systems built by Skale Club.",
    locale: "en_US",
  },
  "barbershops-br": {
    title: "Marketing para Barbearias | Skale Club",
    description:
      "Mais clientes para sua barbearia com site, avaliações no Google e sistema de agendamento feitos pela Skale Club.",
    locale: "pt_BR",
  },
  grupo: {
    title: "Grupo do Skale Hub no WhatsApp | Skale Club",
    description:
      "Receba os avisos das lives semanais do Skale Hub no seu WhatsApp: aquisição de clientes nos EUA, Google Ads, Meta Ads, CRM, automação e IA.",
    locale: "pt_BR",
  },
};

// A managed bilingual pair stores single-segment slugs (`x` and `x-br`), but the PT
// member's canonical public URL is the `/br/x` prefix form. Legacy `/x-br` and
// `/x/br` URLs keep rendering; they simply self-report the `/br/x` canonical.
export function landingPathForSlug(slug: string): string {
  return slug.endsWith("-br") ? withLanguage(`/${slug.slice(0, -3)}`, "pt") : `/${slug}`;
}

// Inverse of landingPathForSlug. Returns "" for "/" (in either language) or any
// path that isn't a single managed-landing segment.
export function slugForLandingPath(pathname: string): string {
  const { path, language } = splitLanguagePath(pathname);
  if (path === "/" || path === "") return "";

  const segments = path.slice(1).split("/");
  if (segments.length !== 1) return "";
  return language === "pt" ? `${segments[0]}-br` : segments[0];
}

export function getLandingSeo(slug: string): LandingSeo | undefined {
  return LANDING_SEO[slug];
}
