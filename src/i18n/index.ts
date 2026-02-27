import fr from './fr.json';
import en from './en.json';
import es from './es.json';
import de from './de.json';
import it from './it.json';
import pt from './pt.json';
import nl from './nl.json';
import ar from './ar.json';
import zh from './zh.json';
import ja from './ja.json';
import ko from './ko.json';
import ru from './ru.json';

export type SupportedLanguage = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl' | 'ar' | 'zh' | 'ja' | 'ko' | 'ru';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'ar', 'zh', 'ja', 'ko', 'ru',
];

export const LANGUAGE_META: Record<SupportedLanguage, { flag: string; label: string; rtl?: boolean }> = {
  fr: { flag: '🇫🇷', label: 'Francais' },
  en: { flag: '🇬🇧', label: 'English' },
  es: { flag: '🇪🇸', label: 'Espanol' },
  de: { flag: '🇩🇪', label: 'Deutsch' },
  it: { flag: '🇮🇹', label: 'Italiano' },
  pt: { flag: '🇵🇹', label: 'Portugues' },
  nl: { flag: '🇳🇱', label: 'Nederlands' },
  ar: { flag: '🇸🇦', label: 'العربية', rtl: true },
  zh: { flag: '🇨🇳', label: '中文' },
  ja: { flag: '🇯🇵', label: '日本語' },
  ko: { flag: '🇰🇷', label: '한국어' },
  ru: { flag: '🇷🇺', label: 'Русский' },
};

const translations: Record<SupportedLanguage, Record<string, string>> = {
  fr, en, es, de, it, pt, nl, ar, zh, ja, ko, ru,
};

export function getTranslations(lang: SupportedLanguage): Record<string, string> {
  return translations[lang] ?? translations.fr;
}

export function detectBrowserLanguage(): SupportedLanguage {
  const languages = navigator.languages ?? [navigator.language];
  for (const lang of languages) {
    const code = lang.split('-')[0].toLowerCase() as SupportedLanguage;
    if (SUPPORTED_LANGUAGES.includes(code)) {
      return code;
    }
  }
  return 'fr';
}
