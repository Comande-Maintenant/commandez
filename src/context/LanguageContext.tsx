import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { getTranslations, loadLanguage, isLanguageLoaded, detectBrowserLanguage, SUPPORTED_LANGUAGES, type Language } from "@/i18n";

interface MenuTranslatable {
  name: string;
  description?: string;
  translations?: Record<string, { name: string; description?: string }>;
}

interface CategoryTranslatable {
  name: string;
  categoryTranslations?: Record<string, Record<string, string>> | null;
}

interface LanguageContextValue {
  language: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tMenu: (item: MenuTranslatable) => { name: string; description?: string };
  tCategory: (name: string, categoryTranslations?: Record<string, Record<string, string>> | null) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "cm_language";

function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved as Language)) {
      return saved as Language;
    }
  } catch {
    // localStorage not available
  }
  return detectBrowserLanguage();
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [, setTranslationsVersion] = useState(0);

  // Load non-fr language on mount if needed
  useEffect(() => {
    const initial = getInitialLanguage();
    if (initial !== "fr" && !isLanguageLoaded(initial)) {
      loadLanguage(initial).then(() => {
        setTranslationsVersion((v) => v + 1);
      });
    }
  }, []);

  const changeLanguage = useCallback((lang: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }

    if (isLanguageLoaded(lang)) {
      setLanguage(lang);
    } else {
      loadLanguage(lang).then(() => {
        setLanguage(lang);
      });
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = getTranslations(language);
      let text = dict[key] || getTranslations("fr")[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v));
        });
      }
      return text;
    },
    [language]
  );

  const tMenu = useCallback(
    (item: MenuTranslatable) => {
      if (language === "fr" || !item.translations?.[language]) {
        return { name: item.name, description: item.description };
      }
      return {
        name: item.translations[language].name || item.name,
        description: item.translations[language].description || item.description,
      };
    },
    [language]
  );

  const tCategory = useCallback(
    (name: string, categoryTranslations?: Record<string, Record<string, string>> | null) => {
      if (language === "fr" || !categoryTranslations?.[language]?.[name]) {
        return name;
      }
      return categoryTranslations[language][name];
    },
    [language]
  );

  const isRTL = language === "ar";

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language, isRTL]);

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t, tMenu, tCategory, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
