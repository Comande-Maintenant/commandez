import type { CuisineType } from "@/types/customization";

export const CUISINE_TYPE_OPTIONS: { value: CuisineType; label: string; labelKey: string }[] = [
  { value: "kebab", label: "Kebab / Turc / Doner", labelKey: "cuisine.kebab" },
  { value: "pizza", label: "Pizzeria", labelKey: "cuisine.pizza" },
  { value: "burger", label: "Burger", labelKey: "cuisine.burger" },
  { value: "sushi", label: "Sushi / Japonais", labelKey: "cuisine.sushi" },
  { value: "indian", label: "Indien", labelKey: "cuisine.indian" },
  { value: "chinese", label: "Chinois / Asiatique", labelKey: "cuisine.chinese" },
  { value: "bakery", label: "Boulangerie / Sandwicherie", labelKey: "cuisine.bakery" },
  { value: "poke", label: "Poke Bowl", labelKey: "cuisine.poke" },
  { value: "creperie", label: "Creperie", labelKey: "cuisine.creperie" },
  { value: "coffee_shop", label: "Coffee Shop / Cafe", labelKey: "cuisine.coffee_shop" },
  { value: "tacos_fr", label: "Tacos (francais)", labelKey: "cuisine.tacos_fr" },
  { value: "generic", label: "Autre / Generique", labelKey: "cuisine.generic" },
];

// Map cuisine display names to cuisine_type for auto-detection
export const CUISINE_TYPE_MAP: Record<string, CuisineType> = {
  kebab: "kebab",
  "döner": "kebab",
  doner: "kebab",
  turc: "kebab",
  istanbul: "kebab",
  antalya: "kebab",
  pizza: "pizza",
  pizzeria: "pizza",
  burger: "burger",
  sushi: "sushi",
  japonais: "sushi",
  indien: "indian",
  chinois: "chinese",
  asiatique: "chinese",
  wok: "chinese",
  boulangerie: "bakery",
  sandwicherie: "bakery",
  bagel: "bakery",
  poke: "poke",
  "poké": "poke",
  "crêperie": "creperie",
  creperie: "creperie",
  "café": "coffee_shop",
  cafe: "coffee_shop",
  coffee: "coffee_shop",
  tacos: "tacos_fr",
};

export function detectCuisineType(name: string, cuisine?: string): CuisineType {
  const search = `${name} ${cuisine ?? ""}`.toLowerCase();
  for (const [keyword, type] of Object.entries(CUISINE_TYPE_MAP)) {
    if (search.includes(keyword)) return type;
  }
  return "generic";
}
