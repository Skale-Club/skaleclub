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
      description: "Ready-made apps and the services we perform: AI, automation, websites, marketing and more.",
    },
    pt: {
      title: "Nossas Soluções | Skale Club",
      description: "Apps prontos e os serviços que prestamos: IA, automação, sites, marketing e mais.",
    },
    crumb: { en: "Our Solutions", pt: "Nossas Soluções" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  contact: {
    en: {
      title: "Contact | Skale Club",
      description: "Get in touch with Skale Club. Call, email or send us a message and we will get back to you.",
    },
    pt: {
      title: "Contato | Skale Club",
      description: "Fale com a Skale Club. Ligue, envie um e-mail ou mande uma mensagem e retornaremos em breve.",
    },
    crumb: { en: "Contact", pt: "Contato" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  faq: {
    en: {
      title: "FAQ | Skale Club",
      description: "Find answers to common questions about our services.",
    },
    pt: {
      title: "Perguntas Frequentes | Skale Club",
      description: "Encontre respostas para perguntas comuns sobre nossos serviços.",
    },
    crumb: { en: "FAQ", pt: "Perguntas Frequentes" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  blog: {
    en: {
      title: "Blog | Skale Club",
      description: "Tips, guides, and insights about marketing services",
    },
    pt: {
      title: "Blog | Skale Club",
      description: "Dicas, guias e insights sobre serviços de marketing.",
    },
    crumb: { en: "Blog", pt: "Blog" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  links: {
    en: {
      title: "Links | Skale Club",
      description: "All the Skale Club links in one place: website, proposals, portfolio and blog.",
    },
    pt: {
      title: "Links | Skale Club",
      description: "Todos os links da Skale Club em um só lugar: site, propostas, portfólio e blog.",
    },
    crumb: { en: "Links", pt: "Links" },
    sitemap: false,
    ogImage: CORE_OG_IMAGE,
  },
  hub: {
    en: {
      title: "Skale Hub | Skale Club",
      description:
        "Weekly live sessions on winning clients in the US: Google Ads, Meta Ads, CRM, automation and AI. Register to join the next Skale Hub.",
    },
    pt: {
      title: "Skale Hub | Skale Club",
      description:
        "Lives semanais sobre aquisição de clientes nos EUA: Google Ads, Meta Ads, CRM, automação e IA. Cadastre-se para entrar no próximo Skale Hub.",
    },
    crumb: { en: "Skale Hub", pt: "Skale Hub" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  privacyPolicy: {
    en: {
      title: "Privacy Policy | Skale Club",
      description: "Read how Skale Club collects, uses and protects your personal information.",
    },
    pt: {
      title: "Política de Privacidade | Skale Club",
      description: "Saiba como a Skale Club coleta, usa e protege as suas informações pessoais.",
    },
    crumb: { en: "Privacy Policy", pt: "Política de Privacidade" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
  termsOfService: {
    en: {
      title: "Terms of Service | Skale Club",
      description: "Read the terms that govern your use of the Skale Club website and services.",
    },
    pt: {
      title: "Termos de Serviço | Skale Club",
      description: "Leia os termos que regem o uso do site e dos serviços da Skale Club.",
    },
    crumb: { en: "Terms of Service", pt: "Termos de Serviço" },
    sitemap: true,
    ogImage: CORE_OG_IMAGE,
  },
};

// Bump when core copy changes: it is the sitemap <lastmod> of the core pages.
export const CORE_PAGES_LASTMOD = "2026-09-29";

// Never indexed: private viewers, admin/OAuth/print tooling, the order form and
// thank-you pages. The `/br/...` twin of each is covered too.
const NOINDEX_PREFIXES = ["/e", "/p", "/admin", "/print", "/oauth", "/nfc-order", "/thankyou", "/thank-you"];

export function isNoindexPath(pathname: string, pageSlugs?: Partial<PageSlugs> | null): boolean {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const path = clean === "/br" ? "/" : clean.startsWith("/br/") ? clean.slice(3) : clean;
  const prefixes = [...NOINDEX_PREFIXES, buildPagePaths(pageSlugs).thankYou];
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
