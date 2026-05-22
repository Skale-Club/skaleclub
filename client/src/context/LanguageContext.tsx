import { createContext, useState, useEffect, ReactNode } from 'react';
import { translationCache } from '@/hooks/useTranslation';

export type Language = 'en' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
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

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    // Clear cache so stale translations from the previous language aren't served
    translationCache.clear();
  };

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

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
