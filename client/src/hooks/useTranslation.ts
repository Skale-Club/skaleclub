import { useContext, useCallback, useEffect, useState } from 'react';
import { LanguageContext } from '@/context/LanguageContext';
import { translations as staticTranslations } from '@/lib/translations';

// In-memory translation cache
const translationCache = new Map<string, string>();
const pendingTranslations = new Set<string>();
let batchTimeout: NodeJS.Timeout | null = null;
const pendingBatch = new Set<string>();
let activeBatchCount = 0;

/**
 * Fetch translations from API and update cache
 */
async function fetchTranslations(texts: string[], targetLanguage: string) {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, targetLanguage }),
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
    console.error('Translation fetch error:', err);
    return {};
  }
}

/**
 * Batch translation requests to avoid excessive API calls
 */
function scheduleBatchTranslation(text: string, targetLanguage: string) {
  const cacheKey = `${targetLanguage}:${text}`;

  // Already translated or being fetched
  if (translationCache.has(cacheKey) || pendingTranslations.has(cacheKey)) {
    return;
  }

  pendingTranslations.add(cacheKey);
  pendingBatch.add(text);

  // Clear existing timeout
  if (batchTimeout) {
    clearTimeout(batchTimeout);
  }

  // Schedule batch fetch after 50ms of no new requests
  batchTimeout = setTimeout(async () => {
    const textsToTranslate = Array.from(pendingBatch);
    pendingBatch.clear();

    activeBatchCount++;
    window.dispatchEvent(new CustomEvent('translations-batch-start'));

    await fetchTranslations(textsToTranslate, targetLanguage);

    // Remove from pending
    textsToTranslate.forEach(t => {
      pendingTranslations.delete(`${targetLanguage}:${t}`);
    });

    activeBatchCount--;
    window.dispatchEvent(new CustomEvent('translations-updated', {
      detail: { allDone: activeBatchCount === 0 },
    }));
  }, 50);
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  const [updateCounter, setUpdateCounter] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);

  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }

  const { language, setLanguage } = context;

  // Listen for translation batch start/finish
  useEffect(() => {
    const handleStart = () => setIsTranslating(true);
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
    };
  }, []);

  /**
   * Translate a string to the current language
   * 1. Runtime cache (in-memory)
   * 2. Static dictionary (instant, no API)
   * 3. API batch (50ms debounce)
   */
  const t = useCallback((text: string): string => {
    if (language === 'en' || !text) {
      return text;
    }

    const cacheKey = `${language}:${text}`;

    // 1. Return from runtime cache if available
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)!;
    }

    // 2. Check static dictionary (instant, no API call)
    if (language === 'pt') {
      const staticValue = staticTranslations.pt[text as keyof typeof staticTranslations.pt];
      if (staticValue) {
        translationCache.set(cacheKey, staticValue);
        return staticValue;
      }
    }

    // 3. Schedule batch translation via API
    scheduleBatchTranslation(text, language);

    // Return original text as fallback while loading
    return text;
  }, [language, updateCounter]);

  return {
    language,
    setLanguage,
    t,
    isEnglish: language === 'en',
    isPortuguese: language === 'pt',
    isTranslating,
  };
}
