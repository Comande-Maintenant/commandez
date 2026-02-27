import fr from "./fr.json";
import en from "./en.json";
import es from "./es.json";
import de from "./de.json";
import it from "./it.json";
import pt from "./pt.json";
import nl from "./nl.json";
import ar from "./ar.json";
import zh from "./zh.json";
import ja from "./ja.json";
import ko from "./ko.json";
import ru from "./ru.json";

export const SUPPORTED_LANGUAGES = ["fr", "en", "es", "de", "it", "pt", "nl", "ar", "zh", "ja", "ko", "ru"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGES = [
  { code: "fr" as const, name: "Francais", flag: "\ud83c\uddeb\ud83c\uddf7" },
  { code: "en" as const, name: "English", flag: "\ud83c\uddec\ud83c\udde7" },
  { code: "es" as const, name: "Espanol", flag: "\ud83c\uddea\ud83c\uddf8" },
  { code: "de" as const, name: "Deutsch", flag: "\ud83c\udde9\ud83c\uddea" },
  { code: "it" as const, name: "Italiano", flag: "\ud83c\uddee\ud83c\uddf9" },
  { code: "pt" as const, name: "Portugues", flag: "\ud83c\udde7\ud83c\uddf7" },
  { code: "nl" as const, name: "Nederlands", flag: "\ud83c\uddf3\ud83c\uddf1" },
  { code: "ar" as const, name: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", flag: "\ud83c\uddf8\ud83c\udde6" },
  { code: "zh" as const, name: "\u4e2d\u6587", flag: "\ud83c\udde8\ud83c\uddf3" },
  { code: "ja" as const, name: "\u65e5\u672c\u8a9e", flag: "\ud83c\uddef\ud83c\uddf5" },
  { code: "ko" as const, name: "\ud55c\uad6d\uc5b4", flag: "\ud83c\uddf0\ud83c\uddf7" },
  { code: "ru" as const, name: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439", flag: "\ud83c\uddf7\ud83c\uddfa" },
] as const;

const translations: Record<Language, Record<string, string>> = {
  fr, en, es, de, it, pt, nl, ar, zh, ja, ko, ru,
};

export function getTranslations(lang: Language): Record<string, string> {
  return translations[lang] || translations.fr;
}

export function detectBrowserLanguage(): Language {
  const browserLang = navigator.language?.split("-")[0] || "fr";
  if (SUPPORTED_LANGUAGES.includes(browserLang as Language)) {
    return browserLang as Language;
  }
  const preferred = navigator.languages?.find((lang) =>
    SUPPORTED_LANGUAGES.includes(lang.split("-")[0] as Language)
  );
  return (preferred?.split("-")[0] as Language) || "fr";
}
