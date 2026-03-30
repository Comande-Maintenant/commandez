import { useMemo } from "react";

interface BusinessLabels {
  menuLabel: string;
  itemsLabel: string;
  orderLabel: string;
  orderVerb: string;
  categoryDefault: string;
  emptyMenu: string;
  storefrontSubtitle: string;
}

const LABELS: Record<string, BusinessLabels> = {
  restaurant: {
    menuLabel: "Menu",
    itemsLabel: "Plats",
    orderLabel: "Commande",
    orderVerb: "Commander",
    categoryDefault: "Specialites",
    emptyMenu: "Le menu sera bientot disponible",
    storefrontSubtitle: "Commandez et recuperez sur place",
  },
  boulangerie: {
    menuLabel: "Nos produits",
    itemsLabel: "Produits",
    orderLabel: "Commande",
    orderVerb: "Commander",
    categoryDefault: "Pains",
    emptyMenu: "Les produits seront bientot disponibles",
    storefrontSubtitle: "Commandez et recuperez sur place",
  },
  boucherie: {
    menuLabel: "Notre etal",
    itemsLabel: "Produits",
    orderLabel: "Commande",
    orderVerb: "Commander",
    categoryDefault: "Viandes",
    emptyMenu: "Les produits seront bientot disponibles",
    storefrontSubtitle: "Commandez et recuperez sur place",
  },
  fleuriste: {
    menuLabel: "Nos creations",
    itemsLabel: "Bouquets et compositions",
    orderLabel: "Commande",
    orderVerb: "Commander",
    categoryDefault: "Bouquets",
    emptyMenu: "Les creations seront bientot disponibles",
    storefrontSubtitle: "Commandez et recuperez en boutique",
  },
  epicerie: {
    menuLabel: "Nos produits",
    itemsLabel: "Produits",
    orderLabel: "Commande",
    orderVerb: "Commander",
    categoryDefault: "Epicerie fine",
    emptyMenu: "Les produits seront bientot disponibles",
    storefrontSubtitle: "Commandez et recuperez sur place",
  },
  traiteur: {
    menuLabel: "Notre carte",
    itemsLabel: "Plats et formules",
    orderLabel: "Commande",
    orderVerb: "Commander",
    categoryDefault: "Entrees",
    emptyMenu: "La carte sera bientot disponible",
    storefrontSubtitle: "Commandez et recuperez sur place",
  },
};

export function useBusinessLabels(businessType?: string): BusinessLabels {
  return useMemo(() => {
    return LABELS[businessType ?? "restaurant"] ?? LABELS.restaurant;
  }, [businessType]);
}

export function getBusinessLabels(businessType?: string): BusinessLabels {
  return LABELS[businessType ?? "restaurant"] ?? LABELS.restaurant;
}
