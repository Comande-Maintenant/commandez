import type { DbMenuItem } from "@/types/database";

export interface BaseIngredient {
  name: string; // Technical ID (stored in DB as out-of-stock list)
  nameKey: string; // i18n key for display
  icon: string;
  rule: {
    type: "category" | "name_contains";
    match: string[];
  };
  affectsLabel: string; // Fallback description
  affectsLabelKey: string; // i18n key for display
}

const KEBAB_BASE_INGREDIENTS: BaseIngredient[] = [
  {
    name: "Pain", nameKey: "ingredient.pain",
    icon: "🥖",
    rule: { type: "category", match: ["Sandwichs"] },
    affectsLabel: "Tous les sandwichs", affectsLabelKey: "ingredient.affects_sandwichs",
  },
  {
    name: "Galette", nameKey: "ingredient.galette",
    icon: "🫓",
    rule: { type: "name_contains", match: ["galette"] },
    affectsLabel: "Galettes", affectsLabelKey: "ingredient.affects_galettes",
  },
  {
    name: "Tortilla", nameKey: "ingredient.tortilla",
    icon: "🌮",
    rule: { type: "name_contains", match: ["tacos", "wrap"] },
    affectsLabel: "Tacos et wraps", affectsLabelKey: "ingredient.affects_tacos",
  },
  {
    name: "Poulet", nameKey: "ingredient.poulet",
    icon: "🍗",
    rule: { type: "name_contains", match: ["poulet", "chicken", "tikka"] },
    affectsLabel: "Plats avec poulet", affectsLabelKey: "ingredient.affects_poulet",
  },
  {
    name: "Viande kebab", nameKey: "ingredient.viande_kebab",
    icon: "🥩",
    rule: { type: "name_contains", match: ["kebab"] },
    affectsLabel: "Plats avec kebab", affectsLabelKey: "ingredient.affects_kebab",
  },
  {
    name: "Steak", nameKey: "ingredient.steak",
    icon: "🥩",
    rule: { type: "name_contains", match: ["steak", "steack", "hamburger"] },
    affectsLabel: "Steaks et hamburgers", affectsLabelKey: "ingredient.affects_steak",
  },
  {
    name: "Merguez", nameKey: "ingredient.merguez",
    icon: "🌭",
    rule: { type: "name_contains", match: ["merguez"] },
    affectsLabel: "Plats avec merguez", affectsLabelKey: "ingredient.affects_merguez",
  },
  {
    name: "Köfte", nameKey: "ingredient.kofte",
    icon: "🧆",
    rule: { type: "name_contains", match: ["kofte", "köfte", "kôfte", "kâfte", "kafte"] },
    affectsLabel: "Plats avec köfte", affectsLabelKey: "ingredient.affects_kofte",
  },
  {
    name: "Nuggets", nameKey: "ingredient.nuggets",
    icon: "🍗",
    rule: { type: "name_contains", match: ["nugget", "tender"] },
    affectsLabel: "Nuggets et tenders", affectsLabelKey: "ingredient.affects_nuggets",
  },
  {
    name: "Frites", nameKey: "ingredient.frites",
    icon: "🍟",
    rule: { type: "name_contains", match: ["frites", "barquette frites"] },
    affectsLabel: "Barquettes frites", affectsLabelKey: "ingredient.affects_frites",
  },
];

const BASE_INGREDIENTS_BY_CUISINE: Record<string, BaseIngredient[]> = {
  kebab: KEBAB_BASE_INGREDIENTS,
  tacos_fr: KEBAB_BASE_INGREDIENTS,
};

export function getBaseIngredients(cuisineType?: string): BaseIngredient[] {
  return BASE_INGREDIENTS_BY_CUISINE[cuisineType ?? ""] ?? [];
}

/**
 * Check if a menu item is unavailable due to a base ingredient being out of stock.
 * Returns the name of the out-of-stock ingredient if affected, or null.
 */
export function getItemRuptureReason(
  item: DbMenuItem,
  outOfStockIngredients: string[],
  cuisineType?: string
): string | null {
  if (!outOfStockIngredients || outOfStockIngredients.length === 0) return null;

  const baseIngredients = getBaseIngredients(cuisineType);
  const outSet = new Set(outOfStockIngredients);

  for (const bi of baseIngredients) {
    if (!outSet.has(bi.name)) continue;

    if (bi.rule.type === "category") {
      if (bi.rule.match.some((cat) => item.category?.toLowerCase() === cat.toLowerCase())) {
        return bi.name;
      }
    } else if (bi.rule.type === "name_contains") {
      const lowerName = item.name.toLowerCase();
      if (bi.rule.match.some((term) => lowerName.includes(term))) {
        return bi.name;
      }
    }
  }

  return null;
}

/**
 * Check if a menu item is unavailable (shorthand).
 */
export function isItemUnavailable(
  item: DbMenuItem,
  outOfStockIngredients: string[],
  cuisineType?: string
): boolean {
  return getItemRuptureReason(item, outOfStockIngredients, cuisineType) !== null;
}
