export type PlatformLandingLanguage = "en" | "pt";
export type PlatformLandingSlug = "xkedule" | "xtimator" | "xphere" | "xareable" | "xcraper" | "xpot" | "xmartmenu" | "xpeed";
export type PlatformCtaKind = "access" | "contact";

export interface PlatformLandingContent {
  slug: PlatformLandingSlug;
  name: string;
  eyebrow: string;
  headline: string;
  intro: string;
  benefits: [string, string, string];
  seo: { title: string; description: string };
  ctaKind: PlatformCtaKind;
}

export const PLATFORM_LANDING_SLUGS: readonly PlatformLandingSlug[] = [
  "xkedule", "xtimator", "xphere", "xareable", "xcraper", "xpot", "xmartmenu", "xpeed",
];

type LocalizedLanding = Record<PlatformLandingLanguage, PlatformLandingContent>;

const LANDINGS: Record<PlatformLandingSlug, LocalizedLanding> = {
  xkedule: {
    en: {
      slug: "xkedule", name: "Xkedule", eyebrow: "Booking and scheduling",
      headline: "Make booking easier.",
      intro: "Give customers a clear way to find a service and book a time that works.",
      benefits: ["Show services and availability", "Let customers choose a time", "Keep bookings organized"],
      seo: { title: "Xkedule | Online Booking Platform", description: "Manage service listings, availability and customer bookings with Xkedule." },
      ctaKind: "access",
    },
    pt: {
      slug: "xkedule", name: "Xkedule", eyebrow: "Agendamentos e reservas",
      headline: "Facilite os agendamentos.",
      intro: "Ajude clientes a encontrar um serviço e reservar um horário conveniente.",
      benefits: ["Mostre serviços e horários", "Deixe clientes escolherem", "Organize as reservas"],
      seo: { title: "Xkedule | Plataforma de agendamentos", description: "Gerencie serviços, disponibilidade e reservas de clientes com o Xkedule." },
      ctaKind: "access",
    },
  },
  xtimator: {
    en: {
      slug: "xtimator", name: "Xtimator", eyebrow: "Estimates and proposals",
      headline: "Send clear estimates.",
      intro: "Prepare professional estimates that help customers understand the work and next steps.",
      benefits: ["Create consistent estimates", "Share proposals with customers", "Track estimate activity"],
      seo: { title: "Xtimator | Estimates and Proposals", description: "Create and share customer estimates and proposals with Xtimator." },
      ctaKind: "access",
    },
    pt: {
      slug: "xtimator", name: "Xtimator", eyebrow: "Estimativas e propostas",
      headline: "Envie estimativas claras.",
      intro: "Prepare estimativas profissionais para explicar o trabalho e os próximos passos aos clientes.",
      benefits: ["Crie estimativas consistentes", "Compartilhe propostas", "Acompanhe a atividade"],
      seo: { title: "Xtimator | Estimativas e propostas", description: "Crie e compartilhe estimativas e propostas para clientes com o Xtimator." },
      ctaKind: "access",
    },
  },
  xphere: {
    en: {
      slug: "xphere", name: "Xphere", eyebrow: "Operations, CRM and AI workflows",
      headline: "Bring work together.",
      intro: "Coordinate customer operations, CRM work and AI-assisted workflows in one platform.",
      benefits: ["Organize customer activity", "Connect operational workflows", "Use AI in practical processes"],
      seo: { title: "Xphere | Operations, CRM and AI Workflows", description: "Coordinate customer operations, CRM workflows and AI-assisted processes with Xphere." },
      ctaKind: "access",
    },
    pt: {
      slug: "xphere", name: "Xphere", eyebrow: "Operações, CRM e fluxos com IA",
      headline: "Conecte o trabalho.",
      intro: "Coordene operações com clientes, atividades de CRM e fluxos de trabalho assistidos por IA em uma plataforma.",
      benefits: ["Organize atividades de clientes", "Conecte processos operacionais", "Use IA em fluxos práticos"],
      seo: { title: "Xphere | Operações, CRM e fluxos com IA", description: "Coordene operações com clientes, CRM e processos assistidos por IA usando o Xphere." },
      ctaKind: "access",
    },
  },
  xareable: {
    en: {
      slug: "xareable", name: "Xareable", eyebrow: "Branded social content with AI",
      headline: "Create on-brand content.",
      intro: "Plan and produce social media content shaped around your brand with AI assistance.",
      benefits: ["Keep brand details in context", "Draft social content faster", "Organize posts for review"],
      seo: { title: "Xareable | AI Branded Social Content", description: "Plan and create brand-aligned social media content with AI assistance from Xareable." },
      ctaKind: "access",
    },
    pt: {
      slug: "xareable", name: "Xareable", eyebrow: "Conteúdo social com IA e identidade de marca",
      headline: "Crie conteúdo da sua marca.",
      intro: "Planeje e produza conteúdo para redes sociais com assistência de IA e identidade da sua marca.",
      benefits: ["Mantenha a marca como referência", "Escreva conteúdo social mais rápido", "Organize publicações para revisão"],
      seo: { title: "Xareable | Conteúdo social com IA e marca", description: "Planeje e crie conteúdo para redes sociais alinhado à sua marca com o Xareable." },
      ctaKind: "access",
    },
  },
  xcraper: {
    en: {
      slug: "xcraper", name: "Xcraper", eyebrow: "Business lead research",
      headline: "Find relevant businesses.",
      intro: "Build a focused list of business leads from online sources for your sales research.",
      benefits: ["Search for relevant businesses", "Collect useful lead details", "Prepare lists for follow-up"],
      seo: { title: "Xcraper | Business Lead Research", description: "Research businesses and prepare organized lead lists for sales follow-up with Xcraper." },
      ctaKind: "access",
    },
    pt: {
      slug: "xcraper", name: "Xcraper", eyebrow: "Pesquisa de leads empresariais",
      headline: "Encontre empresas relevantes.",
      intro: "Monte uma lista focada de leads empresariais a partir de fontes online para sua pesquisa de vendas.",
      benefits: ["Pesquise empresas relevantes", "Reúna dados úteis de leads", "Prepare listas para acompanhamento"],
      seo: { title: "Xcraper | Pesquisa de leads empresariais", description: "Pesquise empresas e organize listas de leads para acompanhamento comercial com o Xcraper." },
      ctaKind: "access",
    },
  },
  xpot: {
    en: {
      slug: "xpot", name: "Xpot", eyebrow: "Field sales and NFC tools",
      headline: "Take your shop on the go.",
      intro: "Support in-person sales with tools for field teams and NFC-enabled customer experiences.",
      benefits: ["Support sales outside the office", "Use NFC for customer interactions", "Keep field activity connected"],
      seo: { title: "Xpot | Field Sales and NFC Platform", description: "Support field sales and customer experiences with NFC using Xpot." },
      ctaKind: "access",
    },
    pt: {
      slug: "xpot", name: "Xpot", eyebrow: "Vendas em campo e ferramentas NFC",
      headline: "Leve sua loja até o cliente.",
      intro: "Apoie vendas presenciais com ferramentas para equipes externas e experiências com NFC.",
      benefits: ["Apoie vendas fora da loja", "Use NFC na interação com clientes", "Conecte atividades em campo"],
      seo: { title: "Xpot | Plataforma de vendas em campo e NFC", description: "Apoie vendas externas e experiências com clientes usando NFC com o Xpot." },
      ctaKind: "access",
    },
  },
  xmartmenu: {
    en: {
      slug: "xmartmenu", name: "XmartMenu", eyebrow: "Digital menus for restaurants",
      headline: "Make your menu easy to browse.",
      intro: "Share a digital restaurant menu that customers can open on their own devices.",
      benefits: ["Present dishes and details clearly", "Share a menu by link or QR", "Update menu information in one place"],
      seo: { title: "XmartMenu | Digital Restaurant Menus", description: "Create and share digital menus for restaurants with XmartMenu." },
      ctaKind: "access",
    },
    pt: {
      slug: "xmartmenu", name: "XmartMenu", eyebrow: "Cardápios digitais para restaurantes",
      headline: "Facilite a consulta ao cardápio.",
      intro: "Compartilhe um cardápio digital que clientes podem abrir nos próprios celulares.",
      benefits: ["Apresente pratos e detalhes", "Compartilhe por link ou QR", "Atualize informações em um só lugar"],
      seo: { title: "XmartMenu | Cardápios digitais para restaurantes", description: "Crie e compartilhe cardápios digitais para restaurantes com o XmartMenu." },
      ctaKind: "access",
    },
  },
  xpeed: {
    en: {
      slug: "xpeed", name: "Xpeed", eyebrow: "Vehicle profiles and OBD trips",
      headline: "Bring vehicle data together.",
      intro: "Build vehicle profiles and organize OBD trip information in one connected platform.",
      benefits: ["Keep vehicle information organized", "Review OBD trip data", "Connect vehicle activity to a profile"],
      seo: { title: "Xpeed | Vehicle Profiles and OBD Trips", description: "Organize vehicle profiles and OBD trip information with the Xpeed platform." },
      ctaKind: "access",
    },
    pt: {
      slug: "xpeed", name: "Xpeed", eyebrow: "Perfis de veículos e viagens OBD",
      headline: "Reúna dados do veículo.",
      intro: "Crie perfis de veículos e organize informações de viagens OBD em uma plataforma conectada.",
      benefits: ["Organize informações dos veículos", "Consulte dados de viagens OBD", "Associe atividades ao perfil do veículo"],
      seo: { title: "Xpeed | Perfis de veículos e viagens OBD", description: "Organize perfis de veículos e informações de viagens OBD com a plataforma Xpeed." },
      ctaKind: "access",
    },
  },
};

export function getPlatformLanding(slug: string, language: PlatformLandingLanguage): PlatformLandingContent | undefined {
  if (!(PLATFORM_LANDING_SLUGS as readonly string[]).includes(slug)) return undefined;
  return LANDINGS[slug as PlatformLandingSlug][language];
}
