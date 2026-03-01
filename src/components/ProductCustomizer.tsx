import { useState, useMemo, useCallback } from "react";
import { X, ChevronLeft, Check, Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DbMenuItem } from "@/types/database";
import type {
  UniversalCustomizationData,
  DbCuisineStepTemplate,
  DbBase,
  DbViande,
  DbAccompagnement,
  StepSelection,
} from "@/types/customization";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  item: DbMenuItem;
  open: boolean;
  onClose: () => void;
  restaurantSlug: string;
  restaurantId: string;
  customizationData: UniversalCustomizationData;
  menuItems: DbMenuItem[];
  primaryColor: string;
}

interface ResolvedStep {
  template: DbCuisineStepTemplate;
  options: Array<{ id: string; name: string; name_translations?: Record<string, string>; price: number; image?: string | null; meta?: Record<string, unknown> }>;
}

// Resolve data source to concrete options array
function resolveStepOptions(
  step: DbCuisineStepTemplate,
  data: UniversalCustomizationData,
  menuItems: DbMenuItem[],
): ResolvedStep["options"] {
  switch (step.data_source) {
    case "restaurant_bases":
      return data.bases.map((b) => ({
        id: b.id,
        name: b.name,
        name_translations: b.name_translations,
        price: Number(b.price),
        image: b.image,
        meta: { max_viandes: b.max_viandes },
      }));
    case "restaurant_viandes":
      return data.viandes.map((v) => ({
        id: v.id,
        name: v.name,
        name_translations: v.name_translations,
        price: Number(v.supplement),
        image: v.image,
      }));
    case "restaurant_garnitures":
      return data.garnitures.map((g) => ({
        id: g.id,
        name: g.name,
        name_translations: g.name_translations,
        price: Number(g.price_x2 ?? 0),
        meta: { is_default: g.is_default },
      }));
    case "restaurant_sauces": {
      const filterField = step.config?.filter_field as string | undefined;
      let filtered = data.sauces;
      if (filterField) {
        filtered = data.sauces.filter((s) => (s as any)[filterField]);
      }
      return filtered.map((s) => ({
        id: s.id,
        name: s.name,
        name_translations: s.name_translations,
        price: 0,
      }));
    }
    case "restaurant_accompagnements":
      return data.accompagnements.map((a) => ({
        id: a.id,
        name: a.name,
        name_translations: a.name_translations,
        price: Number(a.price_default ?? 0),
        meta: {
          has_sizes: a.has_sizes,
          price_small: a.price_small,
          price_medium: a.price_medium,
          price_large: a.price_large,
          price_default: a.price_default,
          has_sauce_option: a.has_sauce_option,
        },
      }));
    case "menu_items_filter": {
      const filterField = step.config?.filter_field as string | undefined;
      const filterValue = step.config?.filter_value as string | undefined;
      if (!filterField || !filterValue) return [];
      return menuItems
        .filter((m) => (m as any)[filterField] === filterValue && m.enabled)
        .map((m) => ({
          id: m.id,
          name: m.name,
          name_translations: m.translations as any,
          price: m.price,
          image: m.image,
        }));
    }
    case "none":
      return [];
    default:
      return [];
  }
}

// Build filtered steps based on product_type
function buildStepsFromTemplates(
  templates: DbCuisineStepTemplate[],
  productType: string,
  config: UniversalCustomizationData["config"],
): DbCuisineStepTemplate[] {
  let steps = [...templates];

  // Filter based on product_type
  if (productType === "accompagnement") {
    steps = steps.filter((s) =>
      s.step_key === "accompagnement" || s.step_key === "sauce" || s.step_key === "recap"
    );
  } else if (productType === "sandwich_simple") {
    steps = steps.filter((s) =>
      s.step_key !== "base" && s.step_key !== "viande"
    );
  }

  // Filter upsell steps based on config
  steps = steps.filter((s) => {
    if (s.step_type !== "upsell") return true;
    const enableKey = s.config?.enable_config as string | undefined;
    if (!enableKey || !config) return true;
    return (config as any)[enableKey] !== false;
  });

  return steps;
}

export const ProductCustomizer = ({
  item,
  open,
  onClose,
  restaurantSlug,
  restaurantId,
  customizationData,
  menuItems,
  primaryColor,
}: Props) => {
  const { addItem } = useCart();
  const { t, tMenu, language } = useLanguage();
  const accent = primaryColor || "#10B981";
  const translated = tMenu(item);
  const productType = item.product_type || "simple";
  const isMenu = productType === "menu";
  const cuisineType = customizationData.cuisine_type;

  const { bases, viandes, garnitures, sauces, accompagnements, config, stepTemplates } = customizationData;

  const steps = useMemo(
    () => buildStepsFromTemplates(stepTemplates, productType, config),
    [stepTemplates, productType, config]
  );
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex] ?? null;

  // Resolved options for each step
  const resolvedSteps = useMemo(
    () => steps.map((s) => ({ template: s, options: resolveStepOptions(s, customizationData, menuItems) })),
    [steps, customizationData, menuItems]
  );

  // Generic selections map
  const [selections, setSelections] = useState<Map<string, StepSelection>>(new Map());

  // Legacy state for kebab compat (garniture toggles, accomp size, frites sauces)
  const [garnitureState, setGarnitureState] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    garnitures.forEach((g) => { init[g.id] = g.is_default; });
    return init;
  });
  const [selectedAccompagnement, setSelectedAccompagnement] = useState<DbAccompagnement | null>(null);
  const [accompSize, setAccompSize] = useState<"small" | "medium" | "large">("medium");
  const [fritesSauces, setFritesSauces] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  const freeSaucesSandwich = config?.free_sauces_sandwich ?? 3;
  const freeSaucesFrites = config?.free_sauces_frites ?? 2;
  const extraSaucePrice = config?.extra_sauce_price ?? 0.50;
  const fritesSauceOptions = sauces.filter((s) => s.is_for_frites);

  const getStepSelections = useCallback((stepKey: string): StepSelection["selections"] => {
    return selections.get(stepKey)?.selections ?? [];
  }, [selections]);

  const setStepSelections = useCallback((stepKey: string, label: string, sels: StepSelection["selections"]) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.set(stepKey, { stepKey, stepLabel: label, selections: sels });
      return next;
    });
  }, []);

  // Get the selected base (for max_viandes logic)
  const selectedBase = useMemo(() => {
    const baseSel = getStepSelections("base");
    if (baseSel.length === 0) return null;
    return bases.find((b) => b.id === baseSel[0].id) ?? null;
  }, [getStepSelections, bases]);

  const maxViandes = useMemo(() => {
    const step = steps.find((s) => s.step_key === "viande");
    if (step?.config?.max_from_base && selectedBase) {
      return selectedBase.max_viandes ?? 1;
    }
    return 99;
  }, [steps, selectedBase]);

  // Upsell items helpers
  const boissonItems = useMemo(
    () => menuItems.filter((m) => m.product_type === "boisson" && m.enabled),
    [menuItems]
  );
  const dessertItems = useMemo(
    () => menuItems.filter((m) => m.product_type === "dessert" && m.enabled),
    [menuItems]
  );

  // Price calculation
  const totalPrice = useMemo(() => {
    let total = 0;

    // Base price (from selected base or item price)
    const baseSel = getStepSelections("base");
    if (baseSel.length > 0) {
      total += baseSel[0].price;
    } else if (productType === "sandwich_simple") {
      total += item.price;
    }

    // Viande supplements
    const viandeSel = getStepSelections("viande");
    viandeSel.forEach((v) => { total += v.price; });

    // Accompagnement
    if (selectedAccompagnement) {
      if (isMenu) {
        // Included in menu price
      } else if (selectedAccompagnement.has_sizes) {
        const prices = { small: selectedAccompagnement.price_small, medium: selectedAccompagnement.price_medium, large: selectedAccompagnement.price_large };
        total += Number(prices[accompSize] ?? 0);
      } else {
        total += Number(selectedAccompagnement.price_default ?? 0);
      }
    }

    // Extra frites sauces
    const extraFritesSauces = Math.max(0, fritesSauces.length - freeSaucesFrites);
    total += extraFritesSauces * extraSaucePrice;

    // Upsell: boisson
    const boissonSel = getStepSelections("boisson");
    if (boissonSel.length > 0) {
      total += isMenu ? 0 : boissonSel[0].price;
    }

    // Upsell: dessert
    const dessertSel = getStepSelections("dessert");
    if (dessertSel.length > 0) {
      total += dessertSel[0].price;
    }

    return total;
  }, [getStepSelections, selectedAccompagnement, accompSize, fritesSauces, isMenu, item.price, productType, freeSaucesFrites, extraSaucePrice]);

  const goNext = useCallback(() => {
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
  }, [stepIndex, steps.length]);

  const goBack = useCallback(() => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }, [stepIndex]);

  const goToStep = useCallback((idx: number) => {
    setStepIndex(idx);
  }, []);

  // Can proceed from current step?
  const canProceed = useMemo(() => {
    if (!currentStep) return false;
    if (!currentStep.required) return true;
    if (currentStep.step_type === "recap") return true;
    const sel = getStepSelections(currentStep.step_key);
    return sel.length > 0;
  }, [currentStep, getStepSelections]);

  const tName = (nameTranslations: Record<string, string> | undefined, fallback: string) => {
    return nameTranslations?.[language] || fallback;
  };

  // Handle single_select
  const handleSingleSelect = (stepKey: string, label: string, option: ResolvedStep["options"][0]) => {
    setStepSelections(stepKey, label, [{ id: option.id, name: option.name, price: option.price }]);
    // Auto-advance on single select
    if (stepIndex < steps.length - 1) {
      setTimeout(() => setStepIndex(stepIndex + 1), 150);
    }
  };

  // Handle multi_select
  const handleMultiSelect = (stepKey: string, label: string, option: ResolvedStep["options"][0], max: number) => {
    const current = getStepSelections(stepKey);
    const exists = current.find((s) => s.id === option.id);
    let next: StepSelection["selections"];
    if (exists) {
      next = current.filter((s) => s.id !== option.id);
    } else {
      if (current.length >= max) {
        if (max === 1) {
          next = [{ id: option.id, name: option.name, price: option.price }];
        } else {
          return; // at max
        }
      } else {
        next = [...current, { id: option.id, name: option.name, price: option.price }];
      }
    }
    setStepSelections(stepKey, label, next);
  };

  // Handle chip_select (sauces)
  const handleChipSelect = (stepKey: string, label: string, option: ResolvedStep["options"][0]) => {
    const current = getStepSelections(stepKey);
    const exists = current.find((s) => s.id === option.id);
    let next: StepSelection["selections"];
    if (exists) {
      next = current.filter((s) => s.id !== option.id);
    } else {
      if (current.length >= freeSaucesSandwich) return;
      next = [...current, { id: option.id, name: option.name, price: 0 }];
    }
    setStepSelections(stepKey, label, next);
  };

  // Handle upsell select (toggle single item)
  const handleUpsellSelect = (stepKey: string, label: string, option: ResolvedStep["options"][0]) => {
    const current = getStepSelections(stepKey);
    if (current.length > 0 && current[0].id === option.id) {
      setStepSelections(stepKey, label, []);
    } else {
      setStepSelections(stepKey, label, [{ id: option.id, name: option.name, price: option.price, meta: { image: (option as any).image } }]);
    }
  };

  // Handle accompagnement selection (special: sizes + sauce frites)
  const handleSelectAccompagnement = (acc: DbAccompagnement) => {
    setSelectedAccompagnement(acc);
    setStepSelections("accompagnement", t("custom.side"), [{ id: acc.id, name: acc.name, price: Number(acc.price_default ?? 0) }]);
    // Pre-suggest sauces from sandwich
    const sauceSel = getStepSelections("sauce");
    if (acc.has_sauce_option && config?.suggest_sauce_from_sandwich && sauceSel.length > 0) {
      setFritesSauces(sauceSel.slice(0, freeSaucesFrites).map((s) => s.name));
    }
  };

  const handleToggleFritesSauce = (name: string) => {
    setFritesSauces((prev) => {
      if (prev.includes(name)) return prev.filter((s) => s !== name);
      return [...prev, name];
    });
  };

  // Handle garniture toggle
  const handleToggleGarniture = (id: string) => {
    setGarnitureState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleWithAll = () => {
    setGarnitureState((prev) => {
      const next = { ...prev };
      garnitures.forEach((g) => { next[g.id] = g.is_default; });
      return next;
    });
  };

  const handleAddToCart = () => {
    const baseSel = getStepSelections("base");
    const viandeSel = getStepSelections("viande");
    const sauceSel = getStepSelections("sauce");
    const boissonSel = getStepSelections("boisson");
    const dessertSel = getStepSelections("dessert");

    const chosenGarnitures = garnitures
      .filter((g) => garnitureState[g.id])
      .map((g) => ({ name: g.name, level: "oui" as const }));

    const viandeChoice = viandeSel.map((v) => v.name).join(", ");
    const extraCost = totalPrice - (baseSel.length > 0 ? baseSel[0].price : item.price);

    const syntheticItem: DbMenuItem = {
      ...item,
      name: baseSel.length > 0 ? baseSel[0].name : item.name,
      price: baseSel.length > 0 ? baseSel[0].price : item.price,
    };

    // Build generic customChoices
    const customChoices: StepSelection[] = [];
    for (const [key, sel] of selections.entries()) {
      if (sel.selections.length > 0) {
        customChoices.push(sel);
      }
    }
    // Add garnitures to customChoices
    if (chosenGarnitures.length > 0) {
      customChoices.push({
        stepKey: "garniture",
        stepLabel: t("custom.toppings"),
        selections: chosenGarnitures.map((g) => ({ id: g.name, name: g.name, price: 0 })),
      });
    }

    // Build options with both legacy and generic fields
    const cartOptions: Record<string, any> = {
      extraCost,
      customChoices,
    };

    // Legacy fields for kebab compat
    if (cuisineType === "kebab") {
      cartOptions.garnitureChoices = chosenGarnitures.length > 0 ? chosenGarnitures : undefined;
      cartOptions.viandeChoice = viandeChoice || undefined;
      cartOptions.baseChoice = baseSel.length > 0 ? baseSel[0].name : undefined;
      cartOptions.accompagnementChoice = selectedAccompagnement ? {
        name: selectedAccompagnement.name,
        size: selectedAccompagnement.has_sizes ? accompSize : undefined,
        sauces: fritesSauces.length > 0 ? fritesSauces : undefined,
      } : undefined;
      cartOptions.drinkChoice = boissonSel.length > 0 ? { name: boissonSel[0].name, price: isMenu ? 0 : boissonSel[0].price } : undefined;
      cartOptions.dessertChoice = dessertSel.length > 0 ? { name: dessertSel[0].name, price: dessertSel[0].price } : undefined;
    }

    for (let i = 0; i < quantity; i++) {
      addItem(
        syntheticItem,
        sauceSel.map((s) => s.name),
        [],
        restaurantSlug,
        restaurantId,
        cartOptions,
      );
    }

    handleClose();
  };

  const handleClose = () => {
    setStepIndex(0);
    setSelections(new Map());
    setGarnitureState(() => {
      const init: Record<string, boolean> = {};
      garnitures.forEach((g) => { init[g.id] = g.is_default; });
      return init;
    });
    setSelectedAccompagnement(null);
    setAccompSize("medium");
    setFritesSauces([]);
    setQuantity(1);
    onClose();
  };

  if (!open) return null;

  const currentResolved = resolvedSteps[stepIndex] ?? null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={handleClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] flex flex-col rounded-t-3xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            {/* Sticky header */}
            <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {stepIndex > 0 && currentStep?.step_type !== "recap" && (
                    <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100">
                      <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </button>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-gray-900 truncate">{translated.name}</h3>
                    <p className="text-xs text-gray-500">
                      {t("custom.step_of", { current: String(stepIndex + 1), total: String(steps.length) })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold" style={{ color: accent }}>
                    {totalPrice.toFixed(2)} €
                  </span>
                  <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100">
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              </div>
              {/* Progress dots */}
              <div className="flex gap-1 mt-2">
                {steps.map((s, i) => (
                  <div
                    key={s.step_key}
                    className="h-1 flex-1 rounded-full transition-all"
                    style={{ backgroundColor: i <= stepIndex ? accent : "#e5e7eb" }}
                  />
                ))}
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep?.step_key}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                >
                  {currentStep && currentResolved && (
                    <>
                      {/* SINGLE SELECT */}
                      {currentStep.step_type === "single_select" && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">{t(currentStep.label_i18n)}</h4>
                          {currentStep.step_key === "accompagnement" ? (
                            // Special accompagnement handling (sizes + sauce frites)
                            <div className="space-y-2">
                              {accompagnements.map((acc) => {
                                const selected = selectedAccompagnement?.id === acc.id;
                                const displayPrice = acc.has_sizes
                                  ? `${Number(acc.price_small ?? 0).toFixed(2)} - ${Number(acc.price_large ?? 0).toFixed(2)} €`
                                  : `${Number(acc.price_default ?? 0).toFixed(2)} €`;
                                return (
                                  <div key={acc.id}>
                                    <button
                                      onClick={() => handleSelectAccompagnement(acc)}
                                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                                        selected ? "border-current" : "border-gray-200"
                                      }`}
                                      style={selected ? { borderColor: accent, backgroundColor: `${accent}10` } : {}}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-900">{tName(acc.name_translations, acc.name)}</span>
                                        <span className="text-sm font-bold" style={{ color: accent }}>
                                          {isMenu ? t("custom.complet") : displayPrice}
                                        </span>
                                      </div>
                                    </button>
                                    {/* Size selector */}
                                    {selected && acc.has_sizes && !isMenu && (
                                      <div className="flex gap-2 mt-2 ml-2">
                                        {(["small", "medium", "large"] as const).map((size) => {
                                          const sizePrice = acc[`price_${size}`];
                                          if (sizePrice == null) return null;
                                          const labels = { small: "Petit", medium: "Moyen", large: "Grand" };
                                          return (
                                            <button
                                              key={size}
                                              onClick={() => setAccompSize(size)}
                                              className={`flex-1 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                                                accompSize === size ? "text-white" : "border-gray-200 text-gray-700"
                                              }`}
                                              style={accompSize === size ? { backgroundColor: accent, borderColor: accent } : {}}
                                            >
                                              {labels[size]}
                                              <br />
                                              {Number(sizePrice).toFixed(2)} €
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {/* Sauce frites */}
                                    {selected && acc.has_sauce_option && (
                                      <div className="mt-3 ml-2">
                                        <p className="text-xs font-semibold text-gray-700 mb-2">
                                          {t("custom.same_sauce_frites")} ({t("custom.free_sauces", { count: String(freeSaucesFrites) })})
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {fritesSauceOptions.map((s) => {
                                            const sel = fritesSauces.includes(s.name);
                                            const isFree = fritesSauces.indexOf(s.name) < freeSaucesFrites;
                                            return (
                                              <button
                                                key={s.id}
                                                onClick={() => handleToggleFritesSauce(s.name)}
                                                className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                  sel ? "text-white" : "bg-gray-100 text-gray-600"
                                                }`}
                                                style={sel ? { backgroundColor: accent } : {}}
                                              >
                                                {tName(s.name_translations, s.name)}
                                                {sel && !isFree && ` +${extraSaucePrice.toFixed(2)}€`}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              <button onClick={goNext} className="mt-4 text-sm font-medium text-gray-500 underline">
                                {t("custom.no_thanks")}
                              </button>
                            </div>
                          ) : (
                            // Generic single select grid
                            <div className="grid grid-cols-2 gap-2">
                              {currentResolved.options.map((option) => {
                                const sel = getStepSelections(currentStep.step_key);
                                const isSelected = sel.some((s) => s.id === option.id);
                                return (
                                  <button
                                    key={option.id}
                                    onClick={() => handleSingleSelect(currentStep.step_key, t(currentStep.label_i18n), option)}
                                    className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
                                      isSelected ? "border-current" : "border-gray-200"
                                    }`}
                                    style={isSelected ? { borderColor: accent, backgroundColor: `${accent}10` } : {}}
                                  >
                                    <p className="text-sm font-semibold text-gray-900">{tName(option.name_translations, option.name)}</p>
                                    <p className="text-sm font-bold mt-1" style={{ color: accent }}>{option.price.toFixed(2)} €</p>
                                    {(option.meta?.max_viandes as number) > 1 && (
                                      <p className="text-[11px] text-gray-500 mt-0.5">{option.meta!.max_viandes as number} viandes max</p>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* MULTI SELECT */}
                      {currentStep.step_type === "multi_select" && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">{t(currentStep.label_i18n)}</h4>
                          {maxViandes > 1 && maxViandes < 99 && (
                            <p className="text-xs text-gray-500 mb-3">
                              {getStepSelections(currentStep.step_key).length}/{maxViandes} {t("custom.max_selections", { max: String(maxViandes) })}
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            {currentResolved.options.map((option) => {
                              const sel = getStepSelections(currentStep.step_key);
                              const isSelected = sel.some((s) => s.id === option.id);
                              return (
                                <button
                                  key={option.id}
                                  onClick={() => handleMultiSelect(currentStep.step_key, t(currentStep.label_i18n), option, maxViandes)}
                                  className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
                                    isSelected ? "border-current" : "border-gray-200"
                                  }`}
                                  style={isSelected ? { borderColor: accent, backgroundColor: `${accent}10` } : {}}
                                >
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-900">{tName(option.name_translations, option.name)}</p>
                                    {isSelected && <Check className="h-4 w-4" style={{ color: accent }} />}
                                  </div>
                                  {option.price > 0 && (
                                    <p className="text-xs text-gray-500 mt-0.5">+{option.price.toFixed(2)} €</p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* TOGGLE GROUP (garnitures) */}
                      {currentStep.step_type === "toggle_group" && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-900">{t(currentStep.label_i18n)}</h4>
                            <button
                              onClick={handleWithAll}
                              className="text-xs font-semibold px-3 py-1.5 rounded-full text-white"
                              style={{ backgroundColor: accent }}
                            >
                              {t("custom.complet")}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {currentResolved.options.map((option) => (
                              <button
                                key={option.id}
                                onClick={() => handleToggleGarniture(option.id)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                  garnitureState[option.id] ? "border-current" : "border-gray-200"
                                }`}
                                style={garnitureState[option.id] ? { borderColor: accent, backgroundColor: `${accent}10` } : {}}
                              >
                                <span className="text-sm font-medium text-gray-900">{tName(option.name_translations, option.name)}</span>
                                {garnitureState[option.id] && <Check className="h-4 w-4" style={{ color: accent }} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CHIP SELECT (sauces) */}
                      {currentStep.step_type === "chip_select" && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">{t(currentStep.label_i18n)}</h4>
                          <p className="text-xs text-gray-500 mb-3">
                            {t("custom.free_sauces", { count: String(freeSaucesSandwich) })}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {currentResolved.options.map((option) => {
                              const sel = getStepSelections(currentStep.step_key);
                              const isSelected = sel.some((s) => s.id === option.id);
                              return (
                                <button
                                  key={option.id}
                                  onClick={() => handleChipSelect(currentStep.step_key, t(currentStep.label_i18n), option)}
                                  className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                                    isSelected ? "text-white" : "bg-gray-100 text-gray-700"
                                  }`}
                                  style={isSelected ? { backgroundColor: accent } : {}}
                                >
                                  {tName(option.name_translations, option.name)}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            onClick={goNext}
                            className="mt-4 text-sm font-medium text-gray-500 underline"
                          >
                            {t("custom.skip")}
                          </button>
                        </div>
                      )}

                      {/* UPSELL (boisson/dessert) */}
                      {currentStep.step_type === "upsell" && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">{t(currentStep.label_i18n)}</h4>
                          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                            {currentResolved.options.map((option) => {
                              const sel = getStepSelections(currentStep.step_key);
                              const isSelected = sel.some((s) => s.id === option.id);
                              const menuItem = menuItems.find((m) => m.id === option.id);
                              const itemTranslated = menuItem ? tMenu(menuItem) : { name: option.name };
                              return (
                                <button
                                  key={option.id}
                                  onClick={() => handleUpsellSelect(currentStep.step_key, t(currentStep.label_i18n), option)}
                                  className={`flex-shrink-0 w-28 p-3 rounded-xl border-2 text-center transition-all ${
                                    isSelected ? "border-current" : "border-gray-200"
                                  }`}
                                  style={isSelected ? { borderColor: accent, backgroundColor: `${accent}10` } : {}}
                                >
                                  {option.image && (
                                    <img src={option.image} alt={itemTranslated.name} className="h-14 w-14 object-cover rounded-lg mx-auto mb-2" loading="lazy" />
                                  )}
                                  <p className="text-xs font-medium text-gray-900 line-clamp-2">{itemTranslated.name}</p>
                                  <p className="text-xs font-bold mt-1" style={{ color: accent }}>
                                    {isMenu && currentStep.step_key === "boisson" ? t("custom.complet") : `${option.price.toFixed(2)} €`}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                          <button onClick={goNext} className="mt-4 text-sm font-medium text-gray-500 underline">
                            {t("custom.no_thanks")}
                          </button>
                        </div>
                      )}

                      {/* RECAP */}
                      {currentStep.step_type === "recap" && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">{t("custom.recap")}</h4>
                          <div className="space-y-2">
                            {steps.filter((s) => s.step_type !== "recap").map((s, i) => {
                              const sel = getStepSelections(s.step_key);

                              // For garnitures, read from garnitureState instead
                              if (s.step_key === "garniture") {
                                const chosen = garnitures.filter((g) => garnitureState[g.id]);
                                if (chosen.length === 0) return null;
                                return (
                                  <RecapLine
                                    key={s.step_key}
                                    label={t(s.label_i18n)}
                                    value={chosen.map((g) => g.name).join(", ")}
                                    onClick={() => goToStep(i)}
                                    accent={accent}
                                  />
                                );
                              }

                              // For accompagnement, show with size/sauce info
                              if (s.step_key === "accompagnement" && selectedAccompagnement) {
                                const priceStr = isMenu ? undefined : (selectedAccompagnement.has_sizes
                                  ? `${Number(selectedAccompagnement[`price_${accompSize}`] ?? 0).toFixed(2)} €`
                                  : `${Number(selectedAccompagnement.price_default ?? 0).toFixed(2)} €`);
                                return (
                                  <div key={s.step_key}>
                                    <RecapLine
                                      label={t(s.label_i18n)}
                                      value={`${selectedAccompagnement.name}${selectedAccompagnement.has_sizes ? ` (${accompSize})` : ""}`}
                                      price={priceStr}
                                      onClick={() => goToStep(i)}
                                      accent={accent}
                                    />
                                    {fritesSauces.length > 0 && (
                                      <RecapLine
                                        label={t("custom.same_sauce_frites")}
                                        value={fritesSauces.join(", ")}
                                        price={Math.max(0, fritesSauces.length - freeSaucesFrites) > 0
                                          ? `+${(Math.max(0, fritesSauces.length - freeSaucesFrites) * extraSaucePrice).toFixed(2)} €`
                                          : undefined}
                                        onClick={() => goToStep(i)}
                                        accent={accent}
                                      />
                                    )}
                                  </div>
                                );
                              }

                              if (sel.length === 0) return null;

                              const priceSum = sel.reduce((sum, x) => sum + x.price, 0);
                              const priceStr = priceSum > 0 ? (
                                s.step_key === "base" ? `${priceSum.toFixed(2)} €` : `+${priceSum.toFixed(2)} €`
                              ) : undefined;

                              return (
                                <RecapLine
                                  key={s.step_key}
                                  label={t(s.label_i18n)}
                                  value={sel.map((x) => x.name).join(", ")}
                                  price={priceStr}
                                  onClick={() => goToStep(i)}
                                  accent={accent}
                                />
                              );
                            })}
                          </div>

                          {/* Quantity */}
                          <div className="flex items-center justify-center gap-4 mt-6">
                            <button
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              className="p-2 rounded-full bg-gray-100"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="text-lg font-bold w-8 text-center">{quantity}</span>
                            <button
                              onClick={() => setQuantity(quantity + 1)}
                              className="p-2 rounded-full text-white"
                              style={{ backgroundColor: accent }}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Sticky footer */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100">
              {currentStep?.step_type === "recap" ? (
                <button
                  onClick={handleAddToCart}
                  className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-all active:scale-[0.98]"
                  style={{ backgroundColor: accent }}
                >
                  {t("custom.add_to_cart")} - {(totalPrice * quantity).toFixed(2)} €
                </button>
              ) : (
                <button
                  onClick={goNext}
                  disabled={!canProceed}
                  className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  {t("custom.next")}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Recap line sub-component
function RecapLine({
  label,
  value,
  price,
  onClick,
  accent,
}: {
  label: string;
  value: string;
  price?: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-gray-500 uppercase">{label}</p>
        <p className="text-sm text-gray-900 truncate">{value}</p>
      </div>
      {price && (
        <span className="text-sm font-bold ml-2 flex-shrink-0" style={{ color: accent }}>{price}</span>
      )}
    </button>
  );
}
