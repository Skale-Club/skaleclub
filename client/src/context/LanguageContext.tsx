import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { navigate, usePathname } from 'wouter/use-browser-location';
import { isLanguageExemptPath, legacyLanguagePath, splitLanguagePath, stripLanguage, withLanguage } from '@shared/languagePath';
import { translationCache, markLanguageSwitch } from '@/hooks/useTranslation';

export type Language = 'en' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// A managed landing reports its own language (PT-only pages such as /grupo) and the
// URL of its bilingual counterpart. Scoped to the path that registered it.
interface PageLanguageInfo {
  language?: Language;
  alternatePath?: string | null;
}

type SetPageLanguage = (info: PageLanguageInfo | null) => void;

const PageLanguageContext = createContext<SetPageLanguage>(() => {});

export function usePageLanguage(): SetPageLanguage {
  return useContext(PageLanguageContext);
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  // The URL is the only source of truth: no `/br` prefix = English, always.
  const rawPath = usePathname();
  const urlLanguage = splitLanguagePath(rawPath).language;

  const [pageInfo, setPageInfo] = useState<(PageLanguageInfo & { path: string }) | null>(null);
  const activePage = pageInfo && pageInfo.path === rawPath ? pageInfo : null;
  const language: Language = activePage?.language ?? urlLanguage;

  const pageInfoRef = useRef(pageInfo);
  pageInfoRef.current = pageInfo;
  const languageRef = useRef(language);
  languageRef.current = language;

  const setPageLanguage = useCallback<SetPageLanguage>((info) => {
    setPageInfo(info ? { ...info, path: window.location.pathname } : null);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    const pathname = window.location.pathname;
    if (languageRef.current === lang || isLanguageExemptPath(pathname)) return;
    // Only a real switch may show the translation overlay (capped in useTranslation)
    markLanguageSwitch();

    const suffix = window.location.search + window.location.hash;
    const page = pageInfoRef.current?.path === pathname ? pageInfoRef.current : null;
    // Defensive: an alternatePath equal to the current pathname is a no-op,
    // not a real alternate — fall through to the generic rule instead.
    const alternatePath = page?.alternatePath && page.alternatePath !== pathname ? page.alternatePath : null;
    if (alternatePath) {
      navigate(alternatePath + suffix);
    } else if (page?.language) {
      setPageInfo({ ...page, language: lang });
    } else {
      navigate((lang === 'pt' ? withLanguage(pathname, 'pt') : stripLanguage(pathname)) + suffix);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
  }, [language]);

  // One-time redirect for old PT URL shapes (`/x/br`, `/x-br`) to the `/br/x` prefix.
  useEffect(() => {
    const legacyPath = legacyLanguagePath(window.location.pathname);
    if (!legacyPath) return;
    navigate(legacyPath + window.location.search + window.location.hash, { replace: true });
  }, [rawPath]);

  // Clear cache so stale translations from the previous language aren't served
  const previousLanguage = useRef(language);
  useEffect(() => {
    if (previousLanguage.current === language) return;
    previousLanguage.current = language;
    translationCache.clear();
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
      <PageLanguageContext.Provider value={setPageLanguage}>
        {children}
      </PageLanguageContext.Provider>
    </LanguageContext.Provider>
  );
}
