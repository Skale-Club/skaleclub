import { useContext } from 'react';
import { LanguageContext } from '@/context/LanguageContext';
import { translations, type TranslationKey } from '@/lib/translations';

export function useTranslation() {
  const context = useContext(LanguageContext);
  
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }

  const { language, setLanguage } = context;

  /**
   * Translate a string to the current language
   * If the current language is English or translation is not found, returns the original text
   */
  const t = (text: string): string => {
    if (language === 'en') {
      return text;
    }

    // Check if we have a translation for this text
    if (text in translations.pt) {
      return translations.pt[text as TranslationKey];
    }

    // If no translation found, return original text
    return text;
  };

  return {
    language,
    setLanguage,
    t,
    isEnglish: language === 'en',
    isPortuguese: language === 'pt',
  };
}
