import { describe, expect, it } from "vitest";
import ar from "@/i18n/ar.json";
import de from "@/i18n/de.json";
import en from "@/i18n/en.json";
import es from "@/i18n/es.json";
import fr from "@/i18n/fr.json";
import itMessages from "@/i18n/it.json";
import ja from "@/i18n/ja.json";
import ko from "@/i18n/ko.json";
import nl from "@/i18n/nl.json";
import pt from "@/i18n/pt.json";
import ru from "@/i18n/ru.json";
import tr from "@/i18n/tr.json";
import vi from "@/i18n/vi.json";
import zh from "@/i18n/zh.json";
import { isRtlLanguage } from "@/i18n";

const locales = {
  ar,
  de,
  en,
  es,
  fr,
  it: itMessages,
  ja,
  ko,
  nl,
  pt,
  ru,
  tr,
  vi,
  zh,
} satisfies Record<string, Record<string, string>>;

const placeholders = (value: string) =>
  [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
    .map((match) => match[1])
    .sort();

describe("application locale contract", () => {
  const referenceKeys = Object.keys(fr).sort();

  for (const [locale, messages] of Object.entries(locales)) {
    it(`${locale} has exactly the French key set`, () => {
      expect(Object.keys(messages).sort()).toEqual(referenceKeys);
    });

    it(`${locale} preserves interpolation placeholders`, () => {
      for (const key of referenceKeys) {
        expect(placeholders(messages[key]), key).toEqual(
          placeholders(fr[key as keyof typeof fr]),
        );
      }
    });

    it(`${locale} contains no empty translations`, () => {
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), key).not.toBe("");
      }
    });
  }

  it("keeps Arabic as the supported RTL locale", () => {
    expect(isRtlLanguage("ar")).toBe(true);
    expect(isRtlLanguage("fr")).toBe(false);
  });
});
