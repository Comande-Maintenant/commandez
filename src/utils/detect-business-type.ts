const GOOGLE_TYPES_TO_BUSINESS: Record<string, string> = {
  // Restaurant / food service
  restaurant: "restaurant",
  meal_delivery: "restaurant",
  meal_takeaway: "restaurant",
  fast_food_restaurant: "restaurant",
  pizza_restaurant: "restaurant",
  kebab_shop: "restaurant",
  sandwich_shop: "restaurant",
  hamburger_restaurant: "restaurant",
  chinese_restaurant: "restaurant",
  japanese_restaurant: "restaurant",
  indian_restaurant: "restaurant",
  thai_restaurant: "restaurant",
  italian_restaurant: "restaurant",
  mexican_restaurant: "restaurant",
  turkish_restaurant: "restaurant",
  lebanese_restaurant: "restaurant",
  seafood_restaurant: "restaurant",
  steak_house: "restaurant",
  sushi_restaurant: "restaurant",
  food: "restaurant",

  // Boulangerie / patisserie
  bakery: "boulangerie",
  pastry_shop: "boulangerie",

  // Boucherie
  butcher_shop: "boucherie",

  // Fleuriste
  florist: "fleuriste",

  // Epicerie
  grocery_or_supermarket: "epicerie",
  grocery_store: "epicerie",
  supermarket: "epicerie",
  convenience_store: "epicerie",
  food_store: "epicerie",

  // Traiteur
  caterer: "traiteur",
  catering_service: "traiteur",
};

export function detectBusinessType(googleTypes: string[]): string {
  for (const gType of googleTypes) {
    const match = GOOGLE_TYPES_TO_BUSINESS[gType];
    if (match) return match;
  }
  return "autre";
}

export const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant", emoji: "🍕" },
  { value: "boulangerie", label: "Boulangerie", emoji: "🥖" },
  { value: "boucherie", label: "Boucherie", emoji: "🥩" },
  { value: "fleuriste", label: "Fleuriste", emoji: "🌷" },
  { value: "epicerie", label: "Epicerie", emoji: "🛒" },
  { value: "traiteur", label: "Traiteur", emoji: "🍽" },
  { value: "autre", label: "Autre", emoji: "🏪" },
] as const;

export function getBusinessEmoji(type: string): string {
  return BUSINESS_TYPES.find((b) => b.value === type)?.emoji ?? "🏪";
}
