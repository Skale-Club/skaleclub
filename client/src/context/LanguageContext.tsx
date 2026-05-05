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
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Pre-warm translation cache from DB on mount and on language switch
  useEffect(() => {
    if (language !== 'pt') return;
    fetch(`/api/translations/preload?lang=pt`)
      .then(r => r.json())
      .then(({ translations }) => {
        if (!translations) return;
        Object.entries(translations).forEach(([src, tgt]) => {
          translationCache.set(`pt:${src}`, tgt as string);
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
