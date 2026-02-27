import { Globe } from 'lucide-react';
import {
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_META,
} from '@/i18n';

interface LanguageSelectorProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  prominent?: boolean;
}

export function LanguageSelector({ language, onLanguageChange, prominent }: LanguageSelectorProps) {
  const meta = LANGUAGE_META[language];

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${prominent ? 'ring-2 ring-primary/30 rounded-lg' : ''}`}>
      <Globe className="h-4 w-4 text-muted-foreground pointer-events-none" />
      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
        className="appearance-none bg-transparent text-sm font-medium text-foreground cursor-pointer pr-5 py-1 focus:outline-none"
        aria-label={meta.label}
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_META[code].flag} {LANGUAGE_META[code].label}
          </option>
        ))}
      </select>
    </div>
  );
}
