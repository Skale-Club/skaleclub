import { createContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { translationCache, markLanguageSwitch } from '@/hooks/useTranslation';

export type Language = 'en' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language, opts?: { silent?: boolean }) => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    if (saved === 'en' || saved === 'pt') {
      return saved;
    }
    // Default to Portuguese
    return 'pt';
  });

  const languageRef = useRef(language);

  const setLanguage = useCallback((lang: Language, opts?: { silent?: boolean }) => {
    // Only a real switch may show the translation overlay (capped in useTranslation).
    // A silent switch (e.g. a landing page syncing site chrome to its configured
    // language) must never arm the overlay meant for the manual language toggle.
    if (languageRef.current !== lang && !opts?.silent) markLanguageSwitch();
    languageRef.current = lang;
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    // Clear cache so stale translations from the previous language aren't served
    translationCache.clear();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Pre-warm translation cache from DB on mount and on language switch
  useEffect(() => {
    const targetLang = language === 'pt' ? 'pt' : null;
    if (!targetLang) return;
    fetch(`/api/translations/preload?lang=${targetLang}`)
      .then(r => r.json())
      .then(({ translations }) => {
        if (!translations) return;
        Object.entries(translations).forEach(([src, tgt]) => {
          translationCache.set(`${targetLang}:${src}`, tgt as string);
        });
        window.dispatchEvent(new CustomEvent('translations-updated', {
          detail: { allDone: true },
        }));
      })
      .catch(() => {});
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
