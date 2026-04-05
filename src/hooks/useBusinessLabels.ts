import { useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";

export interface BusinessLabels {
  menuLabel: string;
  itemsLabel: string;
  orderLabel: string;
  orderVerb: string;
  categoryDefault: string;
  emptyMenu: string;
  storefrontSubtitle: string;
}

const FIELDS: (keyof BusinessLabels)[] = [
  "menuLabel", "itemsLabel", "orderLabel", "orderVerb",
  "categoryDefault", "emptyMenu", "storefrontSubtitle",
];

const FIELD_TO_KEY: Record<keyof BusinessLabels, string> = {
  menuLabel: "menu_label",
  itemsLabel: "items_label",
  orderLabel: "order_label",
  orderVerb: "order_verb",
  categoryDefault: "category_default",
  emptyMenu: "empty_menu",
  storefrontSubtitle: "storefront_subtitle",
};

function buildLabels(t: (key: string) => string, type: string): BusinessLabels {
  const labels = {} as BusinessLabels;
  for (const field of FIELDS) {
    labels[field] = t(`business.${type}.${FIELD_TO_KEY[field]}`);
  }
  return labels;
}

export function useBusinessLabels(businessType?: string): BusinessLabels {
  const { t } = useLanguage();
  const type = businessType ?? "restaurant";
  return useMemo(() => buildLabels(t, type), [t, type]);
}

export function getBusinessLabels(businessType?: string, t?: (key: string) => string): BusinessLabels {
  const type = businessType ?? "restaurant";
  if (t) return buildLabels(t, type);
  // Fallback for non-React contexts (FR only)
  const fallback: Record<string, BusinessLabels> = {
    restaurant: { menuLabel: "Menu", itemsLabel: "Plats", orderLabel: "Commande", orderVerb: "Commander", categoryDefault: "Specialites", emptyMenu: "Le menu sera bientot disponible", storefrontSubtitle: "Commandez et recuperez sur place" },
  };
  return fallback[type] ?? fallback.restaurant;
}
