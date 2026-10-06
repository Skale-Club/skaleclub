export const BLOG_COVER_WIDTH = 1200;
export const BLOG_COVER_HEIGHT = 675;
export const BLOG_COVER_SAFE_AREA_PERCENT = 8;

const BLOG_COVER_VISUAL_DIRECTIONS = [
  "fotografia documental de um pequeno negócio real, luz natural, momento de trabalho espontâneo e composição assimétrica",
  "colagem editorial tátil feita com papel recortado e materiais físicos, vista frontal, sem aparência de interface digital",
  "natureza-morta vista de cima com objetos reais que expliquem o processo do artigo, organização gráfica e sem telas como foco",
  "fotografia ambiental ampla de um espaço de serviço real, arquitetura e contexto contando a história, sem retrato corporativo posado",
  "fotografia macro de um único objeto físico usado como metáfora específica do artigo, textura real e profundidade de campo curta",
  "fotografia editorial analógica de bastidores, enquadramento inesperado, gesto humano ou processo em andamento e granulação sutil",
] as const;

export type BlogCoverPromptPost = {
  title: string;
  excerpt: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
};

export type BlogCoverPromptContext = {
  visualDirection: string;
  recentCoverTitles: readonly string[];
};

/**
 * Jobs use sequential ids, so this rotation makes neighbouring generated
 * covers change medium/perspective even before the image model interprets the
 * article. Failed jobs may leave gaps, which is harmless: the direction still
 * changes instead of converging on the same default "AI business" scene.
 */
export function pickBlogCoverVisualDirection(seed: number): string {
  const safeSeed = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0;
  return BLOG_COVER_VISUAL_DIRECTIONS[safeSeed % BLOG_COVER_VISUAL_DIRECTIONS.length];
}

export function buildBlogCoverPrompt(
  post: BlogCoverPromptPost,
  context: BlogCoverPromptContext,
): string {
  const recentCovers = context.recentCoverTitles
    .map((title) => title.trim())
    .filter(Boolean)
    .slice(0, 3);

  return [
    `Crie UMA capa editorial específica em ${BLOG_COVER_WIDTH} x ${BLOG_COVER_HEIGHT} pixels (16:9) para um post de blog brasileiro.`,
    `Título: ${post.title}`,
    `Resumo: ${post.excerpt ?? post.metaDescription ?? ""}`,
    `Palavra-chave foco: ${post.focusKeyword ?? ""}`,
    "CONCEITO: traduza o assunto concreto deste artigo em uma cena ou metáfora visual específica. A imagem deve parecer uma fotografia ou peça editorial encomendada para este texto, nunca uma imagem corporativa intercambiável.",
    `DIREÇÃO VISUAL OBRIGATÓRIA DESTA CAPA: ${context.visualDirection}.`,
    `ÁREA SEGURA OBRIGATÓRIA: mantenha o assunto principal, rostos, mãos e todos os objetos importantes dentro dos 84% centrais da tela. Deixe pelo menos ${BLOG_COVER_SAFE_AREA_PERCENT}% de respiro visual livre em cada borda; nada importante pode tocar ou ser cortado pelas extremidades.`,
    "VARIEDADE: não repita pessoa, local, ângulo de câmera, composição, meio visual ou metáfora das capas adjacentes. Preserve apenas uma paleta editorial sóbria em azul-marinho, azul, branco e tons naturais.",
    recentCovers.length > 0
      ? "CAPAS ADJACENTES A DIFERENCIAR (títulos):\n" + recentCovers.map((title) => `- ${title}`).join("\n")
      : "Não há capas anteriores disponíveis; ainda assim escolha uma cena concreta e singular para este artigo.",
    "PROIBIDO: hologramas, circuitos neon, robôs humanoides, cérebros digitais, mãos apontando para telas futuristas, ícones 3D brilhantes, balões de conversa flutuantes, dashboards falsos, texto legível, logotipos, marcas d'água e cenas corporativas genéricas.",
    "Não inclua palavras, letras, números, legendas ou tipografia na imagem.",
  ].join("\n\n");
}
