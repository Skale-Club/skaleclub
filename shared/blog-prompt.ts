// =============================================================================
// shared/blog-prompt.ts
//
// SOURCE OF TRUTH for the MACHINERY: xkedule/shared/blog-prompt.ts — sync
// changes to pickNextPillar / pickSeeded / assignPillar / buildPillarSection /
// buildCatalogSection / buildInternalLinksSection / buildKeywordDedupSection /
// sanitizeGeneratedLinks back there (autoblog-parity SC-05, MASTER §5).
//
// The PILLARS themselves are deliberately NOT shared. Xkedule's are written for
// service businesses that send someone to a customer's home; Skale Club is a
// B2B marketing agency writing for business owners. Porting that catalogue
// verbatim would have produced posts about equipment and site visits. The
// rotation mechanism is what generalises, not the editorial voice.
//
// Why pillars exist at all: this repo's generator refines one RSS item into one
// post with a single "clear and practical" style instruction. That produces a
// consistent voice and almost no structural variety — every post is the same
// shape of commentary. Breadth cannot be asked for in an adjective; it has to
// be scheduled. Each run gets one pillar, rotated least-recently-used, plus a
// title shape and a length band, so variety is a property of the pipeline
// rather than a hope about the model.
//
// Pure module: no I/O, no clock of its own, so every fragment is assertable.
// =============================================================================

/**
 * Tell the model what day it is.
 *
 * A model has no clock. Asked for something "timely" it guesses, and the guess
 * comes from its training distribution rather than from today — which is how a
 * blog ends up publishing a year-in-review in March.
 */
export function todaySection(at: Date, timeZone: string): string {
  const format = (tz: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(at);

  let today: string;
  let zone = timeZone;
  try {
    today = format(timeZone);
  } catch {
    zone = "UTC";
    today = format("UTC");
  }

  return [
    `HOJE É ${today}, no fuso do negócio (${zone}).`,
    "Você não tem relógio próprio: trate isso como fato e derive daí qualquer referência temporal.",
    "Qualquer gancho sazonal ou de calendário deve bater com essa data — as semanas atuais ou as próximas, nunca uma que já passou.",
  ].join("\n");
}

// ─── Length and title shape ──────────────────────────────────────────────────

export interface BlogLengthProfile {
  id: "quick" | "standard" | "deep";
  words: string;
  guidance: string;
}

export const BLOG_LENGTH_PROFILES: readonly BlogLengthProfile[] = [
  { id: "quick", words: "700-1000", guidance: "Resposta direta e focada. Sem encher linguiça para parecer maior." },
  { id: "standard", words: "1200-1600", guidance: "Artigo sólido, com detalhe concreto e exemplos." },
  { id: "deep", words: "2000-2600", guidance: "Guia definitivo: completo, estruturado, com um FAQ no final." },
] as const;

export const BLOG_TITLE_STYLES: Readonly<Record<string, string>> = {
  question: "Escreva o título como a pergunta que o leitor digitaria no Google.",
  "how-to": 'Comece o título com "Como ...".',
  numbered: 'Use um título de lista numerada (ex.: "7 ..."), e entregue exatamente essa lista.',
  statement: "Use uma afirmação direta e confiante como título. Sem dois-pontos, sem subtítulo.",
  "two-part": 'Um título em duas partes com dois-pontos é permitido aqui ("Tema: o que isso muda para você").',
};

// ─── Editorial pillars (Skale Club: B2B marketing agency) ────────────────────

export interface BlogPillar {
  id: string;
  label: string;
  /** Injected into the system message for both the topic and the content call. */
  guidance: string;
  titleStyles: readonly string[];
  lengths: readonly BlogLengthProfile["id"][];
  /** Data the pillar cannot work without; used to filter availability. */
  requires?: "catalog" | "faqs" | "rss";
}

export const BLOG_PILLARS: readonly BlogPillar[] = [
  {
    id: "news-analysis",
    label: "Análise de novidade",
    guidance:
      "Parta do item de FONTE no system message e explique o que ele muda NA PRÁTICA para um dono de negócio B2B brasileiro: o que fazer com isso esta semana, o que ignorar, e por quê. Não resuma a fonte — reaja a ela com a opinião da agência.",
    titleStyles: ["statement", "question", "two-part"],
    lengths: ["quick", "standard"],
    requires: "rss",
  },
  {
    id: "playbook",
    label: "Playbook",
    guidance:
      "Um processo completo que o leitor consegue executar sozinho: etapas em ordem, o que preparar antes, quanto tempo leva cada parte, e como saber que deu certo. Seja específico o bastante para ser seguido, não um checklist genérico.",
    titleStyles: ["how-to", "numbered"],
    lengths: ["standard", "deep"],
  },
  {
    id: "mistake-teardown",
    label: "Erro comum, destrinchado",
    guidance:
      "Pegue UM erro que a agência vê repetidamente em negócios B2B. Descreva como ele aparece, por que parece razoável na hora, o que custa em números e o que fazer no lugar. Sem espantalho: o erro tem que ser um que gente competente comete.",
    titleStyles: ["statement", "question"],
    lengths: ["quick", "standard"],
  },
  {
    id: "metrics",
    label: "Métrica sob a lupa",
    guidance:
      "Escolha UMA métrica (CAC, LTV, taxa de resposta, custo por lead qualificado, ...) e explique-a a sério: o que ela mede de fato, como calcular com os dados que o negócio já tem, a partir de que ponto ela mente, e que decisão ela deveria mudar. Nunca invente benchmarks numéricos.",
    titleStyles: ["question", "statement", "two-part"],
    lengths: ["standard", "deep"],
  },
  {
    id: "comparison",
    label: "Comparação honesta",
    guidance:
      "Compare duas opções reais que o leitor pondera (fazer internamente vs contratar, uma ferramenta vs outra, um canal vs outro). Critérios concretos: esforço, prazo, resultado, risco e o que PUXA o custo — nunca preços inventados. Dê um veredito por cenário, inclusive quando a opção mais barata ganha de verdade.",
    titleStyles: ["question", "statement", "numbered"],
    lengths: ["standard"],
  },
  {
    id: "myth-busting",
    label: "Derrubando mitos",
    guidance:
      "Pegue afirmações que circulam sobre marketing B2B e teste cada uma: veredito primeiro (verdade / mentira / depende), depois o raciocínio. Direto, específico, sem espantalhos.",
    titleStyles: ["numbered", "question"],
    lengths: ["quick", "standard"],
  },
  {
    id: "service-spotlight",
    label: "Serviço em foco",
    guidance:
      "Dedique o post inteiro a UM serviço do catálogo abaixo — de preferência um que nenhum post existente cobriu. O que é, quem precisa, o que custa em tempo e esforço, como é o resultado. Não escorregue para os outros serviços.",
    titleStyles: ["statement", "question", "two-part"],
    lengths: ["standard", "deep"],
    requires: "catalog",
  },
  {
    id: "faq-deep-dive",
    label: "FAQ aprofundado",
    guidance:
      "Pegue UMA pergunta real de cliente da lista abaixo e responda muito melhor do que um FAQ de duas linhas: a resposta curta primeiro, depois o quadro completo, os casos-limite e uma recomendação prática.",
    titleStyles: ["question"],
    lengths: ["quick", "standard"],
    requires: "faqs",
  },
] as const;

export interface PillarAvailabilityData {
  hasCatalog: boolean;
  hasFaqs: boolean;
  /** Whether this run has an RSS item to react to. */
  hasRssItem: boolean;
}

export function availablePillars(data: PillarAvailabilityData): BlogPillar[] {
  return BLOG_PILLARS.filter((p) =>
    p.requires === "catalog" ? data.hasCatalog :
    p.requires === "faqs" ? data.hasFaqs :
    p.requires === "rss" ? data.hasRssItem : true,
  );
}

/**
 * Least-recently-used rotation. `recentPillarIds` is newest-first (the order
 * job history naturally comes back in). A pillar never used wins outright;
 * otherwise the one whose last use is furthest back. Ties keep catalogue order,
 * so the walk through the pillars is stable and predictable.
 */
export function pickNextPillar(recentPillarIds: string[], available: BlogPillar[]): BlogPillar {
  if (available.length === 0) throw new Error("no pillars available");
  let best = available[0];
  let bestAge = -1;
  for (const pillar of available) {
    const idx = recentPillarIds.indexOf(pillar.id);
    const age = idx === -1 ? Number.POSITIVE_INFINITY : idx;
    if (age > bestAge) { best = pillar; bestAge = age; }
  }
  return best;
}

/** Deterministic pick — seeded by the job id so runs vary but tests do not. */
export function pickSeeded<T>(options: readonly T[], seed: number): T {
  if (options.length === 0) throw new Error("no options");
  return options[Math.abs(Math.trunc(seed)) % options.length];
}

export interface PillarAssignment {
  pillar: BlogPillar;
  titleStyleId: string;
  length: BlogLengthProfile;
}

/** djb2-style string hash. No cryptographic property needed — see assignPillar. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return Math.abs(h | 0);
}

/**
 * The seed alone collapses in steady state: it is the job id, which increments
 * by 1 every run, while pickNextPillar cycles the available pillars in a stable
 * order. A given pillar therefore recurs every N jobs, and its own seed values
 * form an arithmetic sequence k, k+N, k+2N, ... Adding any constant to that
 * sequence cannot change which residue it lands on modulo the number of title
 * styles when gcd(N, styles) > 1 — so most pillars would freeze onto ONE title
 * shape forever. Hashing the seed INTO the pillar-id string breaks the
 * periodicity, because the hash outputs for k, k+N, k+2N are not a progression
 * at all.
 */
export function assignPillar(recentPillarIds: string[], data: PillarAvailabilityData, seed: number): PillarAssignment {
  const pillar = pickNextPillar(recentPillarIds, availablePillars(data));
  const titleStyleId = pickSeeded(pillar.titleStyles, hashString(`${pillar.id}:${seed}`));
  const lengthId = pickSeeded(pillar.lengths, hashString(`${pillar.id}:len:${seed}`));
  const length = BLOG_LENGTH_PROFILES.find((l) => l.id === lengthId)!;
  return { pillar, titleStyleId, length };
}

export function buildPillarSection(a: PillarAssignment, extras?: string): string {
  const lines = [
    `PAUTA DESTE POST — pilar "${a.pillar.label}":`,
    a.pillar.guidance,
    `FORMATO DO TÍTULO: ${BLOG_TITLE_STYLES[a.titleStyleId] ?? BLOG_TITLE_STYLES.statement} Não use o formato "Tema: Subtítulo Explicativo" a menos que este formato permita explicitamente.`,
    `TAMANHO ALVO: ${a.length.words} palavras. ${a.length.guidance}`,
    "UM POST, UM ASSUNTO: comprometa-se com o assunto único desta pauta. Outros serviços ou temas ganham no máximo uma frase de passagem com link interno onde couber — nunca uma seção própria.",
  ];
  if (extras && extras.trim()) lines.push(extras.trim());
  return lines.join("\n");
}

// ─── Grounded context sections ───────────────────────────────────────────────

export function buildCatalogSection(serviceNames: string[]): string {
  const names = serviceNames.map((s) => s.trim()).filter(Boolean).slice(0, 40);
  if (names.length === 0) return "";
  return [
    "CATÁLOGO DE SERVIÇOS (o que esta agência realmente vende):",
    names.join("; "),
    "Cobertura importa: prefira serviços e ângulos que os posts recentes não tocaram. Nunca escreva sobre um serviço que não está neste catálogo.",
  ].join("\n");
}

export interface InternalLink { label: string; path: string }

export function buildInternalLinksSection(links: InternalLink[]): string {
  if (links.length === 0) return "";
  return [
    "LINKS INTERNOS — inclua de 1 a 3 destes no corpo do post como âncoras HTML, onde ajudarem de verdade o leitor:",
    ...links.map((l) => `- <a href="${l.path}">${l.label}</a>`),
    "Use cada um no máximo uma vez, com texto âncora natural (reescreva o rótulo para caber na frase). Estes são os ÚNICOS links permitidos — nenhum outro caminho interno, nenhuma URL externa.",
  ].join("\n");
}

export function buildKeywordDedupSection(recentFocusKeywords: string[]): string {
  const kws = Array.from(new Set(recentFocusKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean))).slice(0, 10);
  if (kws.length === 0) return "";
  return [
    "PALAVRAS-CHAVE FOCO JÁ USADAS RECENTEMENTE (cada uma já tem um post disputando por ela):",
    kws.join(", "),
    "Escolha uma palavra-chave foco DIFERENTE para este post, para que os posts do site não compitam entre si.",
  ].join("\n");
}

/**
 * Enforcement for buildInternalLinksSection: models occasionally invent hrefs,
 * and a hallucinated link reaching a live post is worse than no link at all.
 *
 * Every surviving anchor points at exactly one of `allowedPaths`; everything
 * else is unwrapped to its inner text, so the prose survives and only the link
 * dies. Rebuilt anchors carry href only.
 *
 * Non-string input returns "" rather than throwing: the caller feeds this
 * model output, and a missing optional field must not cost the day's post.
 */
export function sanitizeGeneratedLinks(html: unknown, allowedPaths: string[]): string {
  if (typeof html !== "string") return "";
  const allowed = new Set(allowedPaths.map((p) => p.trim()).filter(Boolean));

  return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (match, inner: string) => {
    const hrefMatch = /\bhref\s*=\s*["']([^"']*)["']/i.exec(match);
    const href = hrefMatch?.[1]?.trim() ?? "";
    // Rebuilt with href only, so a stray target/onclick the model emitted
    // cannot survive even on a link we keep.
    return allowed.has(href) ? `<a href="${href}">${inner}</a>` : inner;
  });
}
