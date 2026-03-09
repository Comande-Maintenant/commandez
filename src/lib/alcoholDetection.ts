/**
 * Alcohol detection dictionary and utility.
 * Used to auto-flag menu items containing alcohol.
 */

// Lowercase keywords per language
const ALCOHOL_KEYWORDS: string[] = [
  // FR
  "bière", "bieres", "bières", "vin", "vins", "rouge", "blanc", "rosé",
  "champagne", "cocktail", "cocktails", "mojito", "spritz", "apérol", "aperol",
  "pastis", "ricard", "whisky", "whiskey", "vodka", "rhum", "gin", "tequila",
  "cognac", "digestif", "apéritif", "aperitif", "kir", "sangria", "pression",
  "demi", "pinte", "pichet", "carafe de vin", "coupe de champagne", "alcool",
  "cidre", "prosecco", "cava",
  // EN
  "beer", "wine", "spirit", "spirits", "liquor", "ale", "lager", "stout",
  "bourbon", "brandy", "cider", "mead",
  // TR
  "bira", "şarap", "rakı", "raki", "likör", "likor", "viski",
  // AR
  "بيرة", "نبيذ", "كحول", "خمر",
  // DE
  "bier", "wein", "schnaps", "sekt", "likör",
  // ES
  "cerveza", "vino", "cóctel", "coctel", "licor", "sangría", "tinto",
  // IT
  "birra", "vino", "grappa", "amaro", "limoncello",
  // PT
  "cerveja", "vinho", "coquetel",
  // NL
  "bier", "wijn", "jenever", "borrel",
  // JA
  "ビール", "ワイン", "カクテル", "酒", "焼酎", "日本酒", "サワー", "ハイボール",
  // KO
  "맥주", "와인", "소주", "칵테일", "막걸리",
  // RU
  "пиво", "вино", "коктейль", "водка", "виски",
  // ZH
  "啤酒", "葡萄酒", "鸡尾酒", "白酒", "酒",
];

// False positive terms to EXCLUDE from detection
const FALSE_POSITIVES = [
  "sans alcool", "alcohol free", "non alcoolisé", "non alcoolise",
  "0%", "0.0%", "alkoholfrei", "sin alcohol", "senza alcol",
  "sem álcool", "sem alcool", "alcoholvrij", "безалкогольн",
  "ノンアルコール", "무알콜", "无酒精",
];

/**
 * Check if a product name likely contains alcohol.
 * Returns true if alcohol keywords are found AND no false positive exclusions match.
 */
export function detectAlcohol(name: string): boolean {
  const lower = name.toLowerCase().trim();

  // Check false positives first
  for (const fp of FALSE_POSITIVES) {
    if (lower.includes(fp)) return false;
  }

  // Check keywords
  for (const kw of ALCOHOL_KEYWORDS) {
    // Word boundary check: keyword must not be part of a longer unrelated word
    // For CJK characters, direct inclusion is fine
    if (/[\u3000-\u9fff\uac00-\ud7af]/.test(kw)) {
      if (lower.includes(kw)) return true;
    } else {
      // For latin/arabic: check word boundaries
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|[\\s,;()\\-/])${escaped}([\\s,;()\\-/]|$)`, "i");
      if (regex.test(lower)) return true;
    }
  }

  return false;
}
