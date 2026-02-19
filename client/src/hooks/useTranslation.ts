import { useContext, useCallback, useEffect, useRef } from 'react';
import { LanguageContext } from '@/context/LanguageContext';

// In-memory translation cache
const translationCache = new Map<string, string>();
const pendingTranslations = new Set<string>();
let batchTimeout: NodeJS.Timeout | null = null;
const pendingBatch = new Set<string>();

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

    await fetchTranslations(textsToTranslate, targetLanguage);

    // Remove from pending
    textsToTranslate.forEach(t => {
      pendingTranslations.delete(`${targetLanguage}:${t}`);
    });

    // Trigger re-render by dispatching custom event
    window.dispatchEvent(new CustomEvent('translations-updated'));
  }, 50);
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  const forceUpdateRef = useRef(0);
  
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }

  const { language, setLanguage } = context;

  // Listen for translation updates
  useEffect(() => {
    const handler = () => {
      forceUpdateRef.current += 1;
    };
    window.addEventListener('translations-updated', handler);
    return () => window.removeEventListener('translations-updated', handler);
  }, []);

  /**
   * Translate a string to the current language
   * Returns original text immediately, then updates when translation is fetched
   */
  const t = useCallback((text: string): string => {
    if (language === 'en' || !text) {
      return text;
    }

    const cacheKey = `${language}:${text}`;
    
    // Return from cache if available
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)!;
    }

    // Schedule batch translation
    scheduleBatchTranslation(text, language);

    // Return original text as fallback
    return text;
  }, [language, forceUpdateRef.current]);

  return {
    language,
    setLanguage,
    t,
    isEnglish: language === 'en',
    isPortuguese: language === 'pt',
  };
}
