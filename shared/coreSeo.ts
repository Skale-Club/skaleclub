import { buildPagePaths, type PageSlugs } from "./pageSlugs.js";
import { CORE_OG_IMAGE, type SeoImage } from "./landingSeo.js";

// Title + description (EN and PT-BR) for the site's own pages, the counterpart of
// LANDING_SEO for managed landings. Read by the server-side injection
// (server/seo/inject.ts) so crawlers see the right tags in the first response,
// and by the client (usePageSeo / useSEO) so client navigation stays in step.
// Paths come from buildPagePaths(), so custom `pageSlugs` from admin settings
// are honoured. English copy mirrors the usePageSeo() calls in client/src/pages;
// PT reuses client/src/lib/translations.ts where an entry exists.

export type CoreSeoKey =
  | "home"
  | "portfolio"
  | "apps"
  | "services"
  | "contact"
  | "faq"
  | "blog"
  | "links"
  | "hub"
  | "privacyPolicy"
  | "termsOfService";

export interface LocalizedSeo {
  title: string;
  description: string;
}

export interface CoreSeoEntry {
  // null: the admin-managed settings (seoTitle / seoDescription) own the copy.
  en: LocalizedSeo | null;
  pt: LocalizedSeo;
  // Short label for BreadcrumbList.
  crumb: { en: string; pt: string };
  // Excluded from sitemap.xml (still indexable when crawled).
  sitemap: boolean;
  ogImage: SeoImage;
}

export const CORE_SEO: Record<CoreSeoKey, CoreSeoEntry> = {
  home: {
    en: null,
    pt: {
      title: "Skale Club | Marketing Orientado a Dados e Crescimento Escalável",
      description:
        "A Skale Club ajuda empresas a crescer com sistemas de marketing orientados a dados, automação e estratégia de crescimento.",
    },
    crumb: { en: "Home", pt: "Início" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  portfolio: {
    en: {
      title: "Our Solutions | Skale Club",
      description: "Ready-made apps and the services we perform for your business: AI, automation, websites, marketing and more. See what we build.",
    },
    pt: {
      title: "Nossas Soluções | Skale Club",
      description: "Apps prontos e os serviços que prestamos para o seu negócio: IA, automação, sites, marketing e mais. Veja o que construímos.",
    },
    crumb: { en: "Our Solutions", pt: "Nossas Soluções" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  apps: {
    en: {
      title: "Apps | Skale Club",
      description: "Ready-made apps we build and run for service businesses, each with a fixed price. Subscribe, set it up with us and start using it.",
    },
    pt: {
      title: "Aplicativos | Skale Club",
      description: "Aplicativos prontos que criamos e operamos para empresas de serviços, cada um com preço fechado. Você assina e começa a usar.",
    },
    crumb: { en: "Apps", pt: "Aplicativos" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  services: {
    en: {
      title: "Services | Skale Club",
      description: "Marketing and technology services tailored to your business: AI, automation, websites and more, quoted for your case.",
    },
    pt: {
      title: "Serviços | Skale Club",
      description: "Serviços de marketing e tecnologia sob medida para o seu negócio: IA, automação, sites e mais, com orçamento para o seu caso.",
    },
    crumb: { en: "Services", pt: "Serviços" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  contact: {
    en: {
      title: "Contact | Skale Club",
      description: "Get in touch with Skale Club. Call, email or send us a message and we will get back to you as soon as possible.",
    },
    pt: {
      title: "Contato | Skale Club",
      description: "Fale com a Skale Club. Ligue, envie um e-mail ou mande uma mensagem pelo site e retornaremos o mais rápido possível.",
    },
    crumb: { en: "Contact", pt: "Contato" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  faq: {
    en: {
      title: "FAQ | Skale Club",
      description: "Answers to common questions about Skale Club services: how we work, pricing, timelines, websites, apps and marketing support.",
    },
    pt: {
      title: "Perguntas Frequentes | Skale Club",
      description: "Respostas para as perguntas mais comuns sobre os serviços da Skale Club: como trabalhamos, preços, prazos, sites e marketing.",
    },
    crumb: { en: "FAQ", pt: "Perguntas Frequentes" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  blog: {
    en: {
      title: "Marketing Blog | Skale Club",
      description: "Tips, guides and insights on marketing, automation and websites for service businesses, from the Skale Club team.",
    },
    pt: {
      title: "Blog de Marketing | Skale Club",
      description: "Dicas, guias e insights sobre marketing, automação e sites para empresas de serviços, direto da equipe da Skale Club.",
    },
    crumb: { en: "Blog", pt: "Blog" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  links: {
    en: {
      title: "Links | Skale Club",
      description: "All the Skale Club links in one place: website, proposals, portfolio and blog. Find what you need and get in touch quickly.",
    },
    pt: {
      title: "Links | Skale Club",
      description: "Todos os links da Skale Club em um só lugar: site, propostas, portfólio e blog. Encontre o que precisa e fale com a gente.",
    },
    crumb: { en: "Links", pt: "Links" },
    sitemap: false,
    ogImage: CORE_OG_IMAGE,
  },
  hub: {
    en: {
      title: "Skale Hub Live Sessions | Skale Club",
      description:
        "Weekly live sessions on winning clients in the US: Google Ads, Meta Ads, CRM, automation and AI. Register to join the next Skale Hub.",
    },
    pt: {
      title: "Lives do Skale Hub | Skale Club",
      description:
        "Lives semanais sobre aquisição de clientes nos EUA: Google Ads, Meta Ads, CRM, automação e IA. Cadastre-se para entrar no próximo Skale Hub.",
    },
    crumb: { en: "Skale Hub", pt: "Lives do Skale Hub" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  privacyPolicy: {
    en: {
      title: "Privacy Policy | Skale Club",
      description: "Read how Skale Club collects, uses and protects your personal information when you visit the site, send a form or contact us.",
    },
    pt: {
      title: "Política de Privacidade | Skale Club",
      description: "Saiba como a Skale Club coleta, usa e protege as suas informações pessoais quando você visita o site, envia um formulário ou fala conosco.",
    },
    crumb: { en: "Privacy Policy", pt: "Política de Privacidade" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  termsOfService: {
    en: {
      title: "Terms of Service | Skale Club",
      description: "Read the terms that govern your use of the Skale Club website and services, and what you can expect from us in return.",
    },
    pt: {
      title: "Termos de Serviço | Skale Club",
      description: "Leia os termos que regem o uso do site e dos serviços da Skale Club, e o que você pode esperar de nós em troca.",
    },
    crumb: { en: "Terms of Service", pt: "Termos de Serviço" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
};

// Bump when core copy changes: it is the sitemap <lastmod> of the core pages.
export const CORE_PAGES_LASTMOD = "2026-10-02";

// Never indexed: private viewers, admin/OAuth/print tooling, the order form and
// thank-you pages. The `/br/...` twin of each is covered too.
// /svg is a free internal tool (logo vectorizer), kept out of search on purpose.
// Private, tooling and thin utility URLs. Public forms (/f/x) and vCards are
// single-purpose utility pages (a form, a contact card) that answer 200 for
// any slug, so they stay out of the index like the thank-you page.
const NOINDEX_PREFIXES = ["/contracts", "/e", "/p", "/w", "/b", "/admin", "/print", "/oauth", "/nfc-order", "/plaque-order", "/thankyou", "/thank-you", "/svg", "/f", "/vcard"];

export function isNoindexPath(pathname: string, pageSlugs?: Partial<PageSlugs> | null): boolean {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const path = clean === "/br" ? "/" : clean.startsWith("/br/") ? clean.slice(3) : clean;
  const custom = buildPagePaths(pageSlugs);
  const prefixes = [...NOINDEX_PREFIXES, custom.thankYou, custom.vcard];
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export const CORE_SEO_KEYS =Object.keys(CORE_SEO) as CoreSeoKey[];

export function corePathForKey(key: CoreSeoKey, pageSlugs?: Partial<PageSlugs> | null): string {
  return buildPagePaths(pageSlugs)[key];
}

// Exact match of a language-stripped path against the core pages. Both the
// configured slug and the default one resolve (the app registers both routes).
export function coreKeyForPath(basePath: string, pageSlugs?: Partial<PageSlugs> | null): CoreSeoKey | undefined {
  const custom = buildPagePaths(pageSlugs);
  const defaults = buildPagePaths(null);
  return CORE_SEO_KEYS.find((key) => basePath === custom[key] || basePath === defaults[key]);
}
