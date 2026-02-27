import { useState, useCallback, useEffect } from 'react';
import {
  type SupportedLanguage,
  LANGUAGE_META,
  getTranslations,
  detectBrowserLanguage,
} from '@/i18n';

const STORAGE_KEY = 'commandez-lang';

export function useLanguage() {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && getTranslations(stored as SupportedLanguage)) {
      return stored as SupportedLanguage;
    }
    return detectBrowserLanguage();
  });

  const strings = getTranslations(language);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const isRTL = LANGUAGE_META[language]?.rtl === true;

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
  }, []);

  // Static UI string translation
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = strings[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [strings]
  );

  // Dynamic menu item translation (from DB translations jsonb)
  const tMenu = useCallback(
    (
      field: string,
      original: string,
      translations?: Record<string, Record<string, string>> | null
    ): string => {
      if (language === 'fr' || !translations) return original;
      return translations[language]?.[field] ?? original;
    },
    [language]
  );

  const hasMenuTranslation = useCallback(
    (translations?: Record<string, Record<string, string>> | null): boolean => {
      if (language === 'fr' || !translations) return true;
      return !!translations[language];
    },
    [language]
  );

  return {
    language,
    setLanguage,
    t,
    tMenu,
    hasMenuTranslation,
    isRTL,
    isFrench: language === 'fr',
  };
}
