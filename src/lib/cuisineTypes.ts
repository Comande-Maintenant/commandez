import type { CuisineType } from "@/types/customization";

export const CUISINE_TYPE_OPTIONS: { value: CuisineType; label: string }[] = [
  { value: "kebab", label: "Kebab / Turc / Doner" },
  { value: "pizza", label: "Pizzeria" },
  { value: "burger", label: "Burger" },
  { value: "sushi", label: "Sushi / Japonais" },
  { value: "indian", label: "Indien" },
  { value: "chinese", label: "Chinois / Asiatique" },
  { value: "bakery", label: "Boulangerie / Sandwicherie" },
  { value: "poke", label: "Poke Bowl" },
  { value: "creperie", label: "Creperie" },
  { value: "coffee_shop", label: "Coffee Shop / Cafe" },
  { value: "tacos_fr", label: "Tacos (francais)" },
  { value: "generic", label: "Autre / Generique" },
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
