import { useContext, useCallback, useEffect, useRef, useState } from 'react';
import { LanguageContext } from '@/context/LanguageContext';
import { translations as staticTranslations, type TranslationKey } from '@/lib/translations';

// In-memory translation cache (exported for preload in LanguageContext)
export const translationCache = new Map<string, string>();
const pendingTranslations = new Set<string>();
let batchTimeout: ReturnType<typeof setTimeout> | null = null;
// Pending texts grouped by direction ("en>pt", "pt>en"). A single shared batch sent
// texts collected before a language switch under the new direction, labelling
// English copy as Portuguese — the AI then answered in Portuguese and that answer
// was cached as a permanent pt -> en row.
const pendingBatches = new Map<string, Set<string>>();
let activeBatchCount = 0;

// A slow AI provider must never hold the page hostage: give up after this long
// and keep the source text.
const TRANSLATE_TIMEOUT_MS = 8_000;

// The full-screen overlay only covers a language switch, and never for longer than
// this. Background translations on page load never block the page.
const LANGUAGE_SWITCH_OVERLAY_MS = 3_000;
let overlayDeadline = 0;

export function markLanguageSwitch() {
  overlayDeadline = Date.now() + LANGUAGE_SWITCH_OVERLAY_MS;
}

// Page props and DB content are authored in English, so on an EN page only text that
// actually looks Portuguese is worth sending for pt -> en translation.
const PT_DIACRITICS = /[ãõçáéíóúâêôà]/i;
const PT_WORDS = /\b(de|da|das|dos|para|com|uma|que|seu|sua|seus|suas|nosso|nossa|pelo|pela|ao|sem|mais)\b/i;

function looksPortuguese(text: string) {
  return PT_DIACRITICS.test(text) || PT_WORDS.test(text);
}

/**
 * Fetch translations from API and update cache
 */
async function fetchTranslations(texts: string[], targetLanguage: string, sourceLanguage = 'en') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS);

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, targetLanguage, sourceLanguage }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('Translation API failed');
    }

    const { translations } = await response.json();

    // Update cache
    Object.entries(translations).forEach(([key, value]) => {
      const cacheKey = `${targetLanguage}:${key}`;
      translationCache.set(cacheKey, value as string);
    });

    return translations;
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('Translation fetch error:', err);
    }
    return {};
  } finally {
    clearTimeout(timer);
  }
}

async function runBatch(texts: string[], targetLanguage: string, sourceLanguage: string) {
  activeBatchCount++;
  window.dispatchEvent(new CustomEvent('translations-batch-start', {
    detail: { blocking: Date.now() < overlayDeadline },
  }));

  await fetchTranslations(texts, targetLanguage, sourceLanguage);

  texts.forEach(t => {
    const cacheKey = `${targetLanguage}:${t}`;
    pendingTranslations.delete(cacheKey);
    // A failed or timed-out string keeps its source text for this session instead of
    // being re-requested on every render (setLanguage clears the cache).
    if (!translationCache.has(cacheKey)) {
      translationCache.set(cacheKey, t);
    }
  });

  activeBatchCount--;
  window.dispatchEvent(new CustomEvent('translations-updated', {
    detail: { allDone: activeBatchCount === 0 },
  }));
}

/**
 * Batch translation requests to avoid excessive API calls
 */
function scheduleBatchTranslation(text: string, targetLanguage: string, sourceLanguage = 'en') {
  const cacheKey = `${targetLanguage}:${text}`;

  // Already translated or being fetched
  if (translationCache.has(cacheKey) || pendingTranslations.has(cacheKey)) {
    return;
  }

  pendingTranslations.add(cacheKey);
  const direction = `${sourceLanguage}>${targetLanguage}`;
  const batch = pendingBatches.get(direction) ?? new Set<string>();
  batch.add(text);
  pendingBatches.set(direction, batch);

  // Clear existing timeout
  if (batchTimeout) {
    clearTimeout(batchTimeout);
  }

  // Schedule batch fetch after 50ms of no new requests — one request per direction
  batchTimeout = setTimeout(() => {
    batchTimeout = null;
    const batches = Array.from(pendingBatches.entries());
    pendingBatches.clear();
    batches.forEach(([batchDirection, texts]) => {
      const [batchSource, batchTarget] = batchDirection.split('>');
      void runBatch(Array.from(texts), batchTarget, batchSource);
    });
  }, 50);
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  const [updateCounter, setUpdateCounter] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }

  const { language, setLanguage } = context;

  // Listen for translation batch start/finish
  useEffect(() => {
    const handleStart = (e: Event) => {
      if (!(e as CustomEvent).detail?.blocking) return;
      setIsTranslating(true);
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      overlayTimer.current = setTimeout(
        () => setIsTranslating(false),
        Math.max(0, overlayDeadline - Date.now()),
      );
    };
    const handleDone = (e: Event) => {
      setUpdateCounter(c => c + 1);
      if ((e as CustomEvent).detail?.allDone) {
        setIsTranslating(false);
      }
    };
    window.addEventListener('translations-batch-start', handleStart);
    window.addEventListener('translations-updated', handleDone);
    return () => {
      window.removeEventListener('translations-batch-start', handleStart);
      window.removeEventListener('translations-updated', handleDone);
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    };
  }, []);

  /**
   * Translate a string to the current language
   * 1. Runtime cache (in-memory)
   * 2. Static dictionary (instant, no API)
   * 3. API batch (50ms debounce)
   */
  // Implementation signature accepts string to satisfy both overloads below.
  // Call sites see the overload cast — string literals must be TranslationKey (TRX-08).
  const t = useCallback((text: string): string => {
    if (!text) return text;

    const cacheKey = `${language}:${text}`;

    // When English is the UI language
    if (language === 'en') {
      // Static strings (keys in translations.pt) are already English — return as-is
      if (text in staticTranslations.pt) return text;

      // 1. Return from cache if PT→EN was already translated
      if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey)!;
      }

      // 2. DB content stored in PT: schedule PT→EN translation via API.
      //    English copy (the common case) renders as-is without an AI round-trip.
      if (!looksPortuguese(text)) return text;
      scheduleBatchTranslation(text, 'en', 'pt');
      return text;
    }

    // When Portuguese is the UI language (existing logic)

    // 1. Return from runtime cache if available
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)!;
    }

    // 2. Check static dictionary (instant, no API call)
    const staticValue = staticTranslations.pt[text as TranslationKey];
    if (staticValue) {
      translationCache.set(cacheKey, staticValue);
      return staticValue;
    }

    // 3. Schedule batch translation via API
    scheduleBatchTranslation(text, language);

    // Return original text as fallback while loading
    return text;
  }, [language, updateCounter]) as {
    // Overload 1: Static keys — TypeScript enforces at compile time that string literals
    // are present in TranslationKey (i.e., defined in translations.ts).
    (text: TranslationKey): string;
    // Overload 2: Dynamic strings from DB content fall through to the API batch translator.
    (text: string): string;
  };

  return {
    language,
    setLanguage,
    t,
    isEnglish: language === 'en',
    isPortuguese: language === 'pt',
    isTranslating,
  };
}
