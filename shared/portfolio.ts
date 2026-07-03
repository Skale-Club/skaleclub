export const PORTFOLIO_DESCRIPTION_MAX_WORDS = 40;
export const PORTFOLIO_DESCRIPTION_MAX_LINES = 6;

export const countWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

const getCharWidthEm = (char: string) => {
  if (char === ' ') return 0.33;
  if (/[ilI\.,'!:;|]/.test(char)) return 0.28;
  if (/[fjrt\(\)\[\]]/.test(char)) return 0.36;
  if (/[A-Z]/.test(char)) return 0.64;
  if (/[mwMW@#%&]/.test(char)) return 0.86;
  if (/[0-9]/.test(char)) return 0.56;
  return 0.52;
};

const getWordWidthEm = (word: string) => Array.from(word).reduce((sum, char) => sum + getCharWidthEm(char), 0);

export const estimateTextLineCount = (text: string, widthPx: number, fontSizePx: number, maxLines = PORTFOLIO_DESCRIPTION_MAX_LINES) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || widthPx <= 0 || fontSizePx <= 0) return 1;

  const maxLineWidthEm = widthPx / fontSizePx;
  let lines = 1;
  let currentWidthEm = 0;

  for (const word of words) {
    const wordWidthEm = getWordWidthEm(word);
    if (currentWidthEm === 0) {
      currentWidthEm = wordWidthEm;
      continue;
    }

    const nextWidthEm = currentWidthEm + getCharWidthEm(' ') + wordWidthEm;
    if (nextWidthEm <= maxLineWidthEm) {
      currentWidthEm = nextWidthEm;
      continue;
    }

    lines += 1;
    currentWidthEm = wordWidthEm;
    if (lines >= maxLines) return maxLines;
  }

  return Math.min(lines, maxLines);
};
