import type { DbMenuItem } from "@/types/database";

export interface BaseIngredient {
  name: string;
  icon: string;
  rule: {
    type: "category" | "name_contains";
    match: string[];
  };
  affectsLabel: string; // Description of what gets disabled
}

const KEBAB_BASE_INGREDIENTS: BaseIngredient[] = [
  {
    name: "Pain",
    icon: "🥖",
    rule: { type: "category", match: ["Sandwichs"] },
    affectsLabel: "Tous les sandwichs",
  },
  {
    name: "Galette",
    icon: "🫓",
    rule: { type: "name_contains", match: ["galette"] },
    affectsLabel: "Galettes",
  },
  {
    name: "Tortilla",
    icon: "🌮",
    rule: { type: "name_contains", match: ["tacos", "wrap"] },
    affectsLabel: "Tacos et wraps",
  },
  {
    name: "Poulet",
    icon: "🍗",
    rule: { type: "name_contains", match: ["poulet", "chicken", "tikka"] },
    affectsLabel: "Plats avec poulet",
  },
  {
    name: "Viande kebab",
    icon: "🥩",
    rule: { type: "name_contains", match: ["kebab"] },
    affectsLabel: "Plats avec kebab",
  },
  {
    name: "Steak",
    icon: "🥩",
    rule: { type: "name_contains", match: ["steak", "steack", "hamburger"] },
    affectsLabel: "Steaks et hamburgers",
  },
  {
    name: "Merguez",
    icon: "🌭",
    rule: { type: "name_contains", match: ["merguez"] },
    affectsLabel: "Plats avec merguez",
  },
  {
    name: "Köfte",
    icon: "🧆",
    rule: { type: "name_contains", match: ["kofte", "köfte", "kôfte", "kâfte", "kafte"] },
    affectsLabel: "Plats avec köfte",
  },
  {
    name: "Nuggets",
    icon: "🍗",
    rule: { type: "name_contains", match: ["nugget", "tender"] },
    affectsLabel: "Nuggets et tenders",
  },
  {
    name: "Frites",
    icon: "🍟",
    rule: { type: "name_contains", match: ["frites", "barquette frites"] },
    affectsLabel: "Barquettes frites",
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
