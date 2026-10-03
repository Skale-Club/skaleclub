import { splitLanguagePath, withLanguage } from "./languagePath.js";

// Single source of truth for managed-landing-page SEO metadata (title, description,
// locale) plus the slug <-> path mapping shared by the server-side crawler injection
// (server/static.ts) and the client-side post-hydration SEO effect
// (client/src/pages/DynamicLanding.tsx). Keyed by DB slug (e.g. "nfc-keychains-br"),
// not by URL path — a managed bilingual pair stores single-segment slugs (`x` and
// `x-br`), but the PT member's canonical public URL is the `/br/x` prefix form.

export type LandingLocale = "en_US" | "pt_BR";

// Social-share image. Served from client/public so Express sends the right
// content type (image/webp). Dimensions are the files' real pixel sizes.
export interface SeoImage {
  path: string;
  width: number;
  height: number;
}

export const CORE_OG_IMAGE: SeoImage = { path: "/SkaleClub.webp", width: 1169, height: 1500 };
export const NFC_OG_IMAGE: SeoImage = { path: "/nfc-keychains-hero.webp", width: 1199, height: 1312 };

export interface LandingSeo {
  title: string;
  description: string;
  locale: LandingLocale;
  robots?: "index, follow" | "noindex, follow";
  ogImage?: SeoImage;
}

export const LANDING_SEO: Record<string, LandingSeo> = {
  "nfc-keychains": {
    title: "Custom NFC Keychains for Businesses | Skale Club",
    description:
      "Custom 3D-printed NFC keychains that open your reviews, Instagram, menu, digital card, or website with one tap.",
    locale: "en_US",
    ogImage: NFC_OG_IMAGE,
  },
  "nfc-keychains-br": {
    title: "Chaveiros NFC Personalizados para Empresas | Skale Club",
    description:
      "Chaveiros NFC personalizados e impressos em 3D para abrir avaliações, Instagram, cardápio, cartão digital ou site com um toque.",
    locale: "pt_BR",
    ogImage: NFC_OG_IMAGE,
  },
  "nfc-order": {
    title: "Complete Your NFC Keychain Order | Skale Club",
    description:
      "Send the details for your custom NFC keychain order. No payment is collected and every design and final price is confirmed before production.",
    locale: "en_US",
    robots: "noindex, follow",
  },
  "nfc-order-br": {
    title: "Complete seu Pedido de Chaveiros NFC | Skale Club",
    description:
      "Envie os dados do seu pedido de chaveiros NFC personalizados. Nenhum pagamento é feito no formulário e confirmamos o design e o valor final antes da produção.",
    locale: "pt_BR",
    robots: "noindex, follow",
  },
  svg: {
    title: "Free Logo to SVG Converter (PNG, JPG) | Skale Club",
    description:
      "Convert a PNG or JPG logo into a clean, editable SVG for Figma, Illustrator and Fusion 360 — exact colors, real corners, no gaps. Free, runs in your browser.",
    locale: "en_US",
  },
  "svg-br": {
    title: "Conversor de Logo para SVG Grátis (PNG, JPG) | Skale Club",
    description:
      "Converta um logo PNG ou JPG em SVG limpo e editável para Figma, Illustrator e Fusion 360 — cores exatas, cantos reais, sem frestas. Grátis, roda no seu navegador.",
    locale: "pt_BR",
  },
  "plaque-order": {
    title: "Complete Your NFC Plaque Order | Skale Club",
    description:
      "Send the details for your NFC counter plaque order. No payment is collected and the final price is confirmed with you before production.",
    locale: "en_US",
    robots: "noindex, follow",
  },
  "plaque-order-br": {
    title: "Complete seu Pedido de Placas NFC | Skale Club",
    description:
      "Envie os dados do seu pedido de placas NFC de balcão. Nenhum pagamento é feito no formulário e confirmamos o valor final com você antes da produção.",
    locale: "pt_BR",
    robots: "noindex, follow",
  },
  "nfc-guide": {
    title: "NFC Keychain Guide: Models, Pricing and FAQs | Skale Club",
    description:
      "Understand flat, raised-relief and custom-shaped NFC keychains, what changes the price, phone compatibility, artwork and the complete order process.",
    locale: "en_US",
    ogImage: NFC_OG_IMAGE,
  },
  "nfc-guide-br": {
    title: "Guia de Chaveiros NFC: Modelos, Preços e Dúvidas | Skale Club",
    description:
      "Entenda os chaveiros NFC flat, com alto-relevo e em formatos personalizados, o que altera o preço, compatibilidade, arte e processo do pedido.",
    locale: "pt_BR",
    ogImage: NFC_OG_IMAGE,
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
    title: "More Clients for Your Barbershop | Skale Club",
    description:
      "A phone that's always answered and a calendar that stays full. Hear it working, or tell us about your shop.",
    locale: "en_US",
  },
  "barbershops-br": {
    title: "Mais Clientes para a Sua Barbearia | Skale Club",
    description:
      "Um telefone sempre atendido e uma agenda sempre cheia. Ouça funcionando ou conte sobre a sua barbearia.",
    locale: "pt_BR",
  },
  grupo: {
    title: "Grupo do Skale Hub no WhatsApp | Skale Club",
    description:
      "Receba os avisos das lives semanais do Skale Hub no seu WhatsApp: aquisição de clientes nos EUA, Google Ads, Meta Ads, CRM, automação e IA.",
    locale: "pt_BR",
  },
  products: {
    title: "Products | Skale Club",
    description:
      "Things we 3D print for your counter: an NFC review plaque and custom NFC keychains.",
    locale: "en_US",
  },
  "products-br": {
    title: "Produtos | Skale Club",
    description:
      "O que a gente imprime em 3D para o seu balcão: uma placa de avaliação NFC e chaveiros NFC personalizados.",
    locale: "pt_BR",
  },
  "nfc-review-plaque": {
    title: "NFC Review Plaque | Skale Club",
    description:
      "A 3D-printed plaque for your counter. Tap a phone on it and it opens your Google review page. Made to order.",
    locale: "en_US",
  },
  "nfc-review-plaque-br": {
    title: "Placa de Avaliação NFC | Skale Club",
    description:
      "Uma placa impressa em 3D para o seu balcão. O cliente encosta o celular e ela abre a sua página de avaliação no Google. Feita sob encomenda.",
    locale: "pt_BR",
  },
  // DB slug for the product at public path /products/nfc-keychains — kept
  // distinct from the existing "nfc-keychains" slug (the ads landing / pricing
  // page at the top-level /nfc-keychains), which is a different page with
  // different content. Reusing that slug here would make this product page
  // render that page's content instead. See PRODUCT_ROUTES below.
  "nfc-custom-keychains": {
    title: "NFC Keychains | Skale Club",
    description:
      "Custom 3D-printed NFC keychains with your branding. The tap opens the link you choose. Made to order.",
    locale: "en_US",
  },
  "nfc-custom-keychains-br": {
    title: "Chaveiros NFC | Skale Club",
    description:
      "Chaveiros NFC personalizados e impressos em 3D com a sua marca. O toque abre o link que você escolher. Feitos sob encomenda.",
    locale: "pt_BR",
  },
};

// Explicit map: public URL segment under /products/<segment> -> DB slug
// (scripts/seed-products-landing.ts). This is the ONLY source of truth for
// that mapping, consumed by the client (DynamicLanding.tsx, to translate the
// URL segment before querying `/api/pages/slug/<dbSlug>`) AND the server
// (server/seo/routes.ts's resolveRoute, for the same lookup; server/seo/
// sitemap.ts and inject.ts go through landingPathForSlug/slugForLandingPath
// below instead of this map directly).
//
// The URL segment and DB slug are the SAME string except for "nfc-keychains":
// that segment maps to DB slug "nfc-custom-keychains", not "nfc-keychains" —
// "nfc-keychains" is already the DB slug of the existing, unrelated ads
// landing / pricing page served at the top-level /nfc-keychains. Reusing it
// here would make /products/nfc-keychains render THAT page's content.
// Do not add an entry whose URL segment collides with an existing top-level
// slug in LANDING_SEO unless you intend exactly that.
export const PRODUCT_ROUTES: Record<string, string> = {
  "nfc-review-plaque": "nfc-review-plaque",
  "nfc-keychains": "nfc-custom-keychains",
};

const PRODUCT_ROUTES_BY_DB_SLUG = new Map(
  Object.entries(PRODUCT_ROUTES).map(([urlSlug, dbSlug]) => [dbSlug, urlSlug]),
);

/** DB slug (as stored in `pages.slug`) for a /products/<urlSlug> URL segment, or undefined if unknown. */
export function productDbSlugForUrlSlug(urlSlug: string): string | undefined {
  // A plain `PRODUCT_ROUTES[urlSlug]` lookup inherits Object.prototype: a
  // request for "/products/constructor" or "/products/__proto__" would
  // return a function/object instead of undefined, 500ing the server
  // resolver (the catch-all "fail open" path would then serve it as an
  // indexable 200) and breaking the client render the same way.
  return Object.hasOwn(PRODUCT_ROUTES, urlSlug) ? PRODUCT_ROUTES[urlSlug] : undefined;
}

// A managed bilingual pair stores single-segment slugs (`x` and `x-br`), but the PT
// member's canonical public URL is the `/br/x` prefix form. Legacy `/x-br` and
// `/x/br` URLs keep rendering; they simply self-report the `/br/x` canonical.
// A product's DB slug (e.g. "nfc-custom-keychains", or its "-br" pair) reports
// its /products/<urlSlug> (or /br/products/<urlSlug>) public path via
// PRODUCT_ROUTES_BY_DB_SLUG — "-br" is stripped from the DB slug FIRST, so the
// product-namespace lookup always sees the bare (English) DB slug, then the
// pt-BR path prefix is applied last.
export function landingPathForSlug(slug: string): string {
  const isPt = slug.endsWith("-br");
  const baseSlug = isPt ? slug.slice(0, -3) : slug;
  const productUrlSlug = PRODUCT_ROUTES_BY_DB_SLUG.get(baseSlug);
  const path = productUrlSlug ? `/products/${productUrlSlug}` : `/${baseSlug}`;
  return isPt ? withLanguage(path, "pt") : path;
}

// Inverse of landingPathForSlug. Returns "" for "/" (in either language) or any
// path that isn't a single managed-landing segment (or a /products/<slug> one
// that resolves through PRODUCT_ROUTES).
export function slugForLandingPath(pathname: string): string {
  const { path, language } = splitLanguagePath(pathname);
  if (path === "/" || path === "") return "";

  const segments = path.slice(1).split("/");
  if (segments.length === 2 && segments[0] === "products") {
    const dbSlug = productDbSlugForUrlSlug(segments[1]);
    if (!dbSlug) return ""; // unmapped -> not a landing (404 elsewhere)
    return language === "pt" ? `${dbSlug}-br` : dbSlug;
  }
  if (segments.length !== 1) return "";
  return language === "pt" ? `${segments[0]}-br` : segments[0];
}

export function getLandingSeo(slug: string): LandingSeo | undefined {
  return LANDING_SEO[slug];
}
