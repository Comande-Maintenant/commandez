/**
 * Color mapping for kitchen garniture display.
 * Each entry maps a keyword (lowercase) to a color dot class.
 * The kitchen view uses this to show colored dots next to toppings
 * for instant visual scanning during rush hours.
 *
 * Format: keyword → { dot: tailwind bg class, bg: tailwind bg class with opacity }
 */

interface GarnitureColor {
  dot: string;
  bg: string;
}

const GARNITURE_COLORS: Record<string, GarnitureColor> = {
  // Greens - salads, lettuce
  salade: { dot: "bg-green-400", bg: "bg-green-100 text-green-800" },
  laitue: { dot: "bg-green-400", bg: "bg-green-100 text-green-800" },
  iceberg: { dot: "bg-green-400", bg: "bg-green-100 text-green-800" },

  // Red - tomatoes
  tomate: { dot: "bg-red-500", bg: "bg-red-100 text-red-800" },
  tomates: { dot: "bg-red-500", bg: "bg-red-100 text-red-800" },

  // White/Yellow - onions
  oignon: { dot: "bg-yellow-200", bg: "bg-yellow-50 text-yellow-800" },
  oignons: { dot: "bg-yellow-200", bg: "bg-yellow-50 text-yellow-800" },

  // Orange - carrots, algerian sauce, harissa
  carotte: { dot: "bg-orange-400", bg: "bg-orange-100 text-orange-800" },
  carottes: { dot: "bg-orange-400", bg: "bg-orange-100 text-orange-800" },
  algerienne: { dot: "bg-orange-400", bg: "bg-orange-100 text-orange-800" },
  algérienne: { dot: "bg-orange-400", bg: "bg-orange-100 text-orange-800" },
  harissa: { dot: "bg-orange-400", bg: "bg-orange-100 text-orange-800" },

  // Brown - meat
  viande: { dot: "bg-amber-700", bg: "bg-amber-100 text-amber-900" },
  poulet: { dot: "bg-amber-700", bg: "bg-amber-100 text-amber-900" },
  boeuf: { dot: "bg-amber-700", bg: "bg-amber-100 text-amber-900" },
  kebab: { dot: "bg-amber-700", bg: "bg-amber-100 text-amber-900" },
  merguez: { dot: "bg-amber-700", bg: "bg-amber-100 text-amber-900" },
  steak: { dot: "bg-amber-700", bg: "bg-amber-100 text-amber-900" },

  // Yellow - cheese
  fromage: { dot: "bg-yellow-400", bg: "bg-yellow-100 text-yellow-800" },
  cheddar: { dot: "bg-yellow-400", bg: "bg-yellow-100 text-yellow-800" },
  mozzarella: { dot: "bg-yellow-400", bg: "bg-yellow-100 text-yellow-800" },
  raclette: { dot: "bg-yellow-400", bg: "bg-yellow-100 text-yellow-800" },

  // Dark - olives
  olive: { dot: "bg-gray-600", bg: "bg-gray-100 text-gray-800" },
  olives: { dot: "bg-gray-600", bg: "bg-gray-100 text-gray-800" },

  // Blue - white sauce, yogurt
  blanche: { dot: "bg-blue-300", bg: "bg-blue-100 text-blue-800" },
  "sauce blanche": { dot: "bg-blue-300", bg: "bg-blue-100 text-blue-800" },
  yaourt: { dot: "bg-blue-300", bg: "bg-blue-100 text-blue-800" },

  // Purple - red cabbage
  "chou rouge": { dot: "bg-purple-400", bg: "bg-purple-100 text-purple-800" },
  chou: { dot: "bg-purple-400", bg: "bg-purple-100 text-purple-800" },

  // Other sauces
  ketchup: { dot: "bg-red-600", bg: "bg-red-100 text-red-800" },
  mayonnaise: { dot: "bg-yellow-200", bg: "bg-yellow-50 text-yellow-800" },
  mayo: { dot: "bg-yellow-200", bg: "bg-yellow-50 text-yellow-800" },
  moutarde: { dot: "bg-yellow-500", bg: "bg-yellow-100 text-yellow-800" },
  barbecue: { dot: "bg-amber-800", bg: "bg-amber-100 text-amber-900" },
  bbq: { dot: "bg-amber-800", bg: "bg-amber-100 text-amber-900" },
  samurai: { dot: "bg-orange-500", bg: "bg-orange-100 text-orange-800" },
  samourai: { dot: "bg-orange-500", bg: "bg-orange-100 text-orange-800" },
  biggy: { dot: "bg-pink-400", bg: "bg-pink-100 text-pink-800" },
  andalouse: { dot: "bg-orange-300", bg: "bg-orange-100 text-orange-800" },

  // Sides
  frites: { dot: "bg-yellow-400", bg: "bg-yellow-100 text-yellow-800" },
  riz: { dot: "bg-gray-200", bg: "bg-gray-100 text-gray-700" },
  "pommes de terre": { dot: "bg-yellow-400", bg: "bg-yellow-100 text-yellow-800" },
};

/**
 * Get the color config for a garniture name.
 * Tries exact match first, then keyword match.
 */
export function getGarnitureColor(name: string): GarnitureColor | null {
  const lower = name.toLowerCase().trim();

  // Exact match
  if (GARNITURE_COLORS[lower]) return GARNITURE_COLORS[lower];

  // Keyword match (check if any key is contained in the name)
  for (const [keyword, color] of Object.entries(GARNITURE_COLORS)) {
    if (lower.includes(keyword)) return color;
  }

  return null;
}
