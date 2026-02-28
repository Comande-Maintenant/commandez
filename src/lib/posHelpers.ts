import type { CustomizationConfig, CustomizationStep } from "@/types/database";
import type {
  POSCustomization,
  POSPersonOrder,
  POSDrinkItem,
  POSDessertItem,
  POSGarnitureChoice,
} from "@/types/pos";

/**
 * Calculate the total price of a customization based on config + selections.
 */
export function calculateCustomizationPrice(
  config: CustomizationConfig,
  customization: POSCustomization
): number {
  let total = config.base_price;

  // Base modifier
  const baseStep = config.steps.find((s) => s.id === "base");
  if (baseStep) {
    const baseOpt = baseStep.options.find((o) => o.id === customization.baseId);
    if (baseOpt) total += baseOpt.price_modifier;
  }

  // Viande modifier(s)
  const viandeStep = config.steps.find((s) => s.id === "viande");
  if (viandeStep) {
    for (const vid of customization.viandeIds) {
      const opt = viandeStep.options.find((o) => o.id === vid);
      if (opt) total += opt.price_modifier;
    }
  }

  // Garniture x2 modifier
  const garnitureStep = config.steps.find((s) => s.id === "garniture");
  if (garnitureStep) {
    for (const g of customization.garnitures) {
      if (g.level === "x2") {
        const opt = garnitureStep.options.find((o) => o.id === g.optionId);
        if (opt) total += opt.price_modifier;
      }
    }
  }

  // Sauce modifier
  const sauceStep = config.steps.find((s) => s.id === "sauces");
  if (sauceStep) {
    for (const sid of customization.sauceIds) {
      const opt = sauceStep.options.find((o) => o.id === sid);
      if (opt) total += opt.price_modifier;
    }
  }

  // Accompagnement + portion modifier
  if (customization.accompagnement) {
    const accStep = config.steps.find((s) => s.id === "accompagnement");
    if (accStep) {
      const opt = accStep.options.find((o) => o.id === customization.accompagnement.optionId);
      if (opt) total += opt.price_modifier;
    }
    total += customization.accompagnement.portionPriceMod;
  }

  // Supplements
  for (const sup of customization.supplements) {
    total += sup.unitPrice * sup.quantity;
  }

  return total;
}

/**
 * Format a person's customization into an order item for the JSONB orders column.
 */
export function formatPOSItemForOrder(person: POSPersonOrder) {
  if (!person.customization) {
    return {
      type: "custom",
      personLabel: person.label,
      name: "Commande vide",
      summary: "",
      price: 0,
      quantity: 1,
      customization: null,
    };
  }

  const c = person.customization;
  const name = `${c.baseName} ${c.viandeNames.join("+")}`.trim();

  return {
    type: "custom",
    personLabel: person.label,
    name,
    summary: formatPOSOrderSummary(c),
    price: person.itemPrice,
    quantity: 1,
    customization: {
      base: c.baseName,
      viande: c.viandeNames,
      garnitures: Object.fromEntries(
        c.garnitures
          .filter((g) => g.level !== "non")
          .map((g) => [g.name, g.level])
      ),
      sauces: c.sauceNames,
      accompagnement: c.accompagnement
        ? {
            name: c.accompagnement.name,
            portion: c.accompagnement.portion,
            subSauce: c.accompagnement.subSauceName || null,
          }
        : null,
      supplements: c.supplements
        .filter((s) => s.quantity > 0)
        .map((s) => ({ name: s.name, quantity: s.quantity })),
    },
  };
}

/**
 * Build a one-line summary text for kitchen display.
 */
export function formatPOSOrderSummary(c: POSCustomization): string {
  const parts: string[] = [];

  // Garnitures
  const activeGarnitures = c.garnitures.filter((g) => g.level !== "non");
  const allGarnituresActive = c.garnitures.length > 0 && c.garnitures.every((g) => g.level !== "non");
  const hasX2 = c.garnitures.some((g) => g.level === "x2");
  const excludedGarnitures = c.garnitures.filter((g) => g.level === "non");

  if (allGarnituresActive && !hasX2) {
    if (excludedGarnitures.length === 0) {
      parts.push("Complet");
    }
  } else if (allGarnituresActive && excludedGarnitures.length === 0 && hasX2) {
    const x2Names = c.garnitures.filter((g) => g.level === "x2").map((g) => g.name);
    parts.push(`Complet (x2 ${x2Names.join("+")})`);
  } else if (activeGarnitures.length > 0) {
    // If most are selected, describe by exclusion
    if (excludedGarnitures.length > 0 && excludedGarnitures.length <= 2 && activeGarnitures.length > excludedGarnitures.length) {
      parts.push(`Complet sans ${excludedGarnitures.map((g) => g.name).join(", ")}`);
      const x2s = activeGarnitures.filter((g) => g.level === "x2");
      if (x2s.length > 0) {
        parts.push(`x2 ${x2s.map((g) => g.name).join("+")}`);
      }
    } else {
      parts.push(
        activeGarnitures
          .map((g) => (g.level === "x2" ? `${g.name} x2` : g.name))
          .join(", ")
      );
    }
  }

  // Sauces
  if (c.sauceNames.length > 0) {
    parts.push(c.sauceNames.join("+"));
  } else {
    parts.push("Sans sauce");
  }

  // Accompagnement
  if (c.accompagnement) {
    let accText = c.accompagnement.name;
    if (c.accompagnement.portion === "double") {
      accText += " double";
    }
    if (c.accompagnement.subSauceName) {
      accText += ` (${c.accompagnement.subSauceName})`;
    }
    parts.push(accText);
  }

  // Supplements
  const activeSups = c.supplements.filter((s) => s.quantity > 0);
  if (activeSups.length > 0) {
    for (const s of activeSups) {
      parts.push(`+${s.quantity > 1 ? s.quantity + "x " : ""}${s.name}`);
    }
  }

  return parts.join(", ");
}

/**
 * Assemble the complete items array for the order from persons + drinks + desserts.
 */
export function buildOrderItems(
  persons: POSPersonOrder[],
  drinks: POSDrinkItem[],
  desserts: POSDessertItem[]
): any[] {
  const items: any[] = [];

  for (const person of persons) {
    if (person.customization) {
      items.push(formatPOSItemForOrder(person));
    }
  }

  for (const drink of drinks) {
    items.push({
      type: "drink",
      personLabel: "Boissons",
      name: drink.name,
      price: drink.price,
      quantity: drink.quantity,
    });
  }

  for (const dessert of desserts) {
    items.push({
      type: "dessert",
      personLabel: "Desserts",
      name: dessert.name,
      price: dessert.price,
      quantity: dessert.quantity,
    });
  }

  return items;
}

/**
 * Calculate grand total from persons + drinks + desserts.
 */
export function calculateGrandTotal(
  persons: POSPersonOrder[],
  drinks: POSDrinkItem[],
  desserts: POSDessertItem[]
): number {
  const personsTotal = persons.reduce((sum, p) => sum + p.itemPrice, 0);
  const drinksTotal = drinks.reduce((sum, d) => sum + d.price * d.quantity, 0);
  const dessertsTotal = desserts.reduce((sum, d) => sum + d.price * d.quantity, 0);
  return personsTotal + drinksTotal + dessertsTotal;
}
