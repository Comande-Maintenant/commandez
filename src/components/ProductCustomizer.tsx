import { useState, useMemo, useCallback } from "react";
import { X, ChevronLeft, Check, Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DbMenuItem } from "@/types/database";
import type { CustomizationData, DbBase, DbViande, DbAccompagnement, DbSauce } from "@/types/customization";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  item: DbMenuItem;
  open: boolean;
  onClose: () => void;
  restaurantSlug: string;
  restaurantId: string;
  customizationData: CustomizationData;
  menuItems: DbMenuItem[];
  primaryColor: string;
}

type StepId = "base" | "viande" | "garniture" | "sauce" | "accompagnement" | "boisson" | "dessert" | "recap";

interface StepDef {
  id: StepId;
  label: string;
  required: boolean;
}

function getSteps(productType: string, config: CustomizationData["config"]): StepDef[] {
  const steps: StepDef[] = [];

  if (productType === "sandwich_personnalisable" || productType === "menu") {
    steps.push({ id: "base", label: "custom.choose_base", required: true });
    steps.push({ id: "viande", label: "custom.choose_meat", required: true });
    steps.push({ id: "garniture", label: "custom.toppings", required: false });
    steps.push({ id: "sauce", label: "custom.sauces", required: false });
    steps.push({ id: "accompagnement", label: "custom.side", required: false });
    if (config?.enable_boisson_upsell) steps.push({ id: "boisson", label: "custom.drink_upsell", required: false });
    if (config?.enable_dessert_upsell) steps.push({ id: "dessert", label: "custom.dessert_upsell", required: false });
  } else if (productType === "sandwich_simple") {
    steps.push({ id: "sauce", label: "custom.sauces", required: false });
    steps.push({ id: "accompagnement", label: "custom.side", required: false });
    if (config?.enable_boisson_upsell) steps.push({ id: "boisson", label: "custom.drink_upsell", required: false });
    if (config?.enable_dessert_upsell) steps.push({ id: "dessert", label: "custom.dessert_upsell", required: false });
  } else if (productType === "accompagnement") {
    steps.push({ id: "accompagnement", label: "custom.side", required: true });
    steps.push({ id: "sauce", label: "custom.sauces", required: false });
  }

  steps.push({ id: "recap", label: "custom.recap", required: true });
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

  const { bases, viandes, garnitures, sauces, accompagnements, config } = customizationData;

  const steps = useMemo(() => getSteps(productType, config), [productType, config]);
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];

  // Selections
  const [selectedBase, setSelectedBase] = useState<DbBase | null>(null);
  const [selectedViandes, setSelectedViandes] = useState<DbViande[]>([]);
  const [garnitureState, setGarnitureState] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    garnitures.forEach((g) => { init[g.id] = g.is_default; });
    return init;
  });
  const [selectedSauces, setSelectedSauces] = useState<string[]>([]);
  const [selectedAccompagnement, setSelectedAccompagnement] = useState<DbAccompagnement | null>(null);
  const [accompSize, setAccompSize] = useState<"small" | "medium" | "large">("medium");
  const [fritesSauces, setFritesSauces] = useState<string[]>([]);
  const [selectedBoisson, setSelectedBoisson] = useState<DbMenuItem | null>(null);
  const [selectedDessert, setSelectedDessert] = useState<DbMenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);

  const maxViandes = selectedBase?.max_viandes ?? 1;
  const freeSaucesSandwich = config?.free_sauces_sandwich ?? 3;
  const freeSaucesFrites = config?.free_sauces_frites ?? 2;
  const extraSaucePrice = config?.extra_sauce_price ?? 0.50;

  const sandwichSauces = sauces.filter((s) => s.is_for_sandwich);
  const fritesSauceOptions = sauces.filter((s) => s.is_for_frites);

  // Menu items for upsell
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

    // Base price
    if (selectedBase) {
      total += Number(selectedBase.price);
    } else if (productType === "sandwich_simple") {
      total += item.price;
    }

    // Viande supplements
    selectedViandes.forEach((v) => { total += Number(v.supplement); });

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

    // Boisson upsell
    if (selectedBoisson) {
      total += isMenu ? 0 : selectedBoisson.price;
    }

    // Dessert upsell
    if (selectedDessert) {
      total += selectedDessert.price;
    }

    return total;
  }, [selectedBase, selectedViandes, selectedAccompagnement, accompSize, fritesSauces, selectedBoisson, selectedDessert, isMenu, item.price, productType, freeSaucesFrites, extraSaucePrice]);

  const goNext = useCallback(() => {
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
  }, [stepIndex, steps.length]);

  const goBack = useCallback(() => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }, [stepIndex]);

  const goToStep = useCallback((idx: number) => {
    setStepIndex(idx);
  }, []);

  const handleSelectBase = (base: DbBase) => {
    setSelectedBase(base);
    setSelectedViandes([]);
    goNext();
  };

  const handleToggleViande = (viande: DbViande) => {
    setSelectedViandes((prev) => {
      const exists = prev.find((v) => v.id === viande.id);
      if (exists) return prev.filter((v) => v.id !== viande.id);
      if (prev.length >= maxViandes) {
        if (maxViandes === 1) return [viande];
        return prev;
      }
      return [...prev, viande];
    });
  };

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

  const handleToggleSauce = (name: string) => {
    setSelectedSauces((prev) => {
      if (prev.includes(name)) return prev.filter((s) => s !== name);
      if (prev.length >= freeSaucesSandwich) return prev;
      return [...prev, name];
    });
  };

  const handleSelectAccompagnement = (acc: DbAccompagnement) => {
    setSelectedAccompagnement(acc);
    // Pre-suggest sauces from sandwich
    if (acc.has_sauce_option && config?.suggest_sauce_from_sandwich && selectedSauces.length > 0) {
      setFritesSauces(selectedSauces.slice(0, freeSaucesFrites));
    }
  };

  const handleToggleFritesSauce = (name: string) => {
    setFritesSauces((prev) => {
      if (prev.includes(name)) return prev.filter((s) => s !== name);
      return [...prev, name];
    });
  };

  const handleAddToCart = () => {
    const chosenGarnitures = garnitures
      .filter((g) => garnitureState[g.id])
      .map((g) => ({ name: g.name, level: "oui" as const }));

    const viandeChoice = selectedViandes.map((v) => v.name).join(", ");

    const extraCost = totalPrice - (selectedBase ? Number(selectedBase.price) : item.price);

    const syntheticItem: DbMenuItem = {
      ...item,
      name: selectedBase ? selectedBase.name : item.name,
      price: selectedBase ? Number(selectedBase.price) : item.price,
    };

    addItem(
      syntheticItem,
      selectedSauces,
      [],
      restaurantSlug,
      restaurantId,
      {
        garnitureChoices: chosenGarnitures.length > 0 ? chosenGarnitures : undefined,
        viandeChoice: viandeChoice || undefined,
        extraCost,
        baseChoice: selectedBase?.name,
        accompagnementChoice: selectedAccompagnement ? {
          name: selectedAccompagnement.name,
          size: selectedAccompagnement.has_sizes ? accompSize : undefined,
          sauces: fritesSauces.length > 0 ? fritesSauces : undefined,
        } : undefined,
        drinkChoice: selectedBoisson ? { name: selectedBoisson.name, price: isMenu ? 0 : selectedBoisson.price } : undefined,
        dessertChoice: selectedDessert ? { name: selectedDessert.name, price: selectedDessert.price } : undefined,
      }
    );

    // Add extra items for quantity > 1
    for (let i = 1; i < quantity; i++) {
      addItem(syntheticItem, selectedSauces, [], restaurantSlug, restaurantId, {
        garnitureChoices: chosenGarnitures.length > 0 ? chosenGarnitures : undefined,
        viandeChoice: viandeChoice || undefined,
        extraCost,
        baseChoice: selectedBase?.name,
        accompagnementChoice: selectedAccompagnement ? {
          name: selectedAccompagnement.name,
          size: selectedAccompagnement.has_sizes ? accompSize : undefined,
          sauces: fritesSauces.length > 0 ? fritesSauces : undefined,
        } : undefined,
        drinkChoice: selectedBoisson ? { name: selectedBoisson.name, price: isMenu ? 0 : selectedBoisson.price } : undefined,
        dessertChoice: selectedDessert ? { name: selectedDessert.name, price: selectedDessert.price } : undefined,
      });
    }

    handleClose();
  };

  const handleClose = () => {
    setStepIndex(0);
    setSelectedBase(null);
    setSelectedViandes([]);
    setGarnitureState(() => {
      const init: Record<string, boolean> = {};
      garnitures.forEach((g) => { init[g.id] = g.is_default; });
      return init;
    });
    setSelectedSauces([]);
    setSelectedAccompagnement(null);
    setAccompSize("medium");
    setFritesSauces([]);
    setSelectedBoisson(null);
    setSelectedDessert(null);
    setQuantity(1);
    onClose();
  };

  const tName = (nameTranslations: Record<string, string>, fallback: string) => {
    return nameTranslations?.[language] || fallback;
  };

  // Can proceed from current step?
  const canProceed = useMemo(() => {
    if (!currentStep) return false;
    if (currentStep.id === "base") return !!selectedBase;
    if (currentStep.id === "viande") return selectedViandes.length > 0;
    return true;
  }, [currentStep, selectedBase, selectedViandes]);

  if (!open) return null;

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
                  {stepIndex > 0 && currentStep?.id !== "recap" && (
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
                    key={s.id}
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
                  key={currentStep?.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Step: Base */}
                  {currentStep?.id === "base" && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">{t("custom.choose_base")}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {bases.map((base) => (
                          <button
                            key={base.id}
                            onClick={() => handleSelectBase(base)}
                            className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
                              selectedBase?.id === base.id ? "border-current" : "border-gray-200"
                            }`}
                            style={selectedBase?.id === base.id ? { borderColor: accent, backgroundColor: `${accent}10` } : {}}
                          >
                            <p className="text-sm font-semibold text-gray-900">{tName(base.name_translations, base.name)}</p>
                            <p className="text-sm font-bold mt-1" style={{ color: accent }}>{Number(base.price).toFixed(2)} €</p>
                            {base.max_viandes > 1 && (
                              <p className="text-[11px] text-gray-500 mt-0.5">{base.max_viandes} viandes max</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step: Viande */}
                  {currentStep?.id === "viande" && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">{t("custom.choose_meat")}</h4>
                      {maxViandes > 1 && (
                        <p className="text-xs text-gray-500 mb-3">
                          {selectedViandes.length}/{maxViandes} {t("custom.max_selections", { max: String(maxViandes) })}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {viandes.map((v) => {
                          const selected = selectedViandes.some((sv) => sv.id === v.id);
                          return (
                            <button
                              key={v.id}
                              onClick={() => handleToggleViande(v)}
                              className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
                                selected ? "border-current" : "border-gray-200"
                              }`}
                              style={selected ? { borderColor: accent, backgroundColor: `${accent}10` } : {}}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-900">{tName(v.name_translations, v.name)}</p>
                                {selected && <Check className="h-4 w-4" style={{ color: accent }} />}
                              </div>
                              {Number(v.supplement) > 0 && (
                                <p className="text-xs text-gray-500 mt-0.5">+{Number(v.supplement).toFixed(2)} €</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Step: Garniture */}
                  {currentStep?.id === "garniture" && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900">{t("custom.toppings")}</h4>
                        <button
                          onClick={handleWithAll}
                          className="text-xs font-semibold px-3 py-1.5 rounded-full text-white"
                          style={{ backgroundColor: accent }}
                        >
                          {t("custom.complet")}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {garnitures.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => handleToggleGarniture(g.id)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                              garnitureState[g.id] ? "border-current" : "border-gray-200"
                            }`}
                            style={garnitureState[g.id] ? { borderColor: accent, backgroundColor: `${accent}10` } : {}}
                          >
                            <span className="text-sm font-medium text-gray-900">{tName(g.name_translations, g.name)}</span>
                            {garnitureState[g.id] && <Check className="h-4 w-4" style={{ color: accent }} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step: Sauce */}
                  {currentStep?.id === "sauce" && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">{t("custom.sauces")}</h4>
                      <p className="text-xs text-gray-500 mb-3">
                        {t("custom.free_sauces", { count: String(freeSaucesSandwich) })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sandwichSauces.map((s) => {
                          const selected = selectedSauces.includes(s.name);
                          return (
                            <button
                              key={s.id}
                              onClick={() => handleToggleSauce(s.name)}
                              className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                                selected ? "text-white" : "bg-gray-100 text-gray-700"
                              }`}
                              style={selected ? { backgroundColor: accent } : {}}
                            >
                              {tName(s.name_translations, s.name)}
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

                  {/* Step: Accompagnement */}
                  {currentStep?.id === "accompagnement" && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">{t("custom.side")}</h4>
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
                      </div>
                      <button onClick={goNext} className="mt-4 text-sm font-medium text-gray-500 underline">
                        {t("custom.no_thanks")}
                      </button>
                    </div>
                  )}

                  {/* Step: Boisson upsell */}
                  {currentStep?.id === "boisson" && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">{t("custom.drink_upsell")}</h4>
                      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                        {boissonItems.map((b) => {
                          const sel = selectedBoisson?.id === b.id;
                          const bTranslated = tMenu(b);
                          return (
                            <button
                              key={b.id}
                              onClick={() => setSelectedBoisson(sel ? null : b)}
                              className={`flex-shrink-0 w-28 p-3 rounded-xl border-2 text-center transition-all ${
                                sel ? "border-current" : "border-gray-200"
                              }`}
                              style={sel ? { borderColor: accent, backgroundColor: `${accent}10` } : {}}
                            >
                              {b.image && (
                                <img src={b.image} alt={bTranslated.name} className="h-14 w-14 object-cover rounded-lg mx-auto mb-2" loading="lazy" />
                              )}
                              <p className="text-xs font-medium text-gray-900 line-clamp-2">{bTranslated.name}</p>
                              <p className="text-xs font-bold mt-1" style={{ color: accent }}>
                                {isMenu ? t("custom.complet") : `${b.price.toFixed(2)} €`}
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

                  {/* Step: Dessert upsell */}
                  {currentStep?.id === "dessert" && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">{t("custom.dessert_upsell")}</h4>
                      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                        {dessertItems.map((d) => {
                          const sel = selectedDessert?.id === d.id;
                          const dTranslated = tMenu(d);
                          return (
                            <button
                              key={d.id}
                              onClick={() => setSelectedDessert(sel ? null : d)}
                              className={`flex-shrink-0 w-28 p-3 rounded-xl border-2 text-center transition-all ${
                                sel ? "border-current" : "border-gray-200"
                              }`}
                              style={sel ? { borderColor: accent, backgroundColor: `${accent}10` } : {}}
                            >
                              {d.image && (
                                <img src={d.image} alt={dTranslated.name} className="h-14 w-14 object-cover rounded-lg mx-auto mb-2" loading="lazy" />
                              )}
                              <p className="text-xs font-medium text-gray-900 line-clamp-2">{dTranslated.name}</p>
                              <p className="text-xs font-bold mt-1" style={{ color: accent }}>{d.price.toFixed(2)} €</p>
                            </button>
                          );
                        })}
                      </div>
                      <button onClick={goNext} className="mt-4 text-sm font-medium text-gray-500 underline">
                        {t("custom.no_thanks")}
                      </button>
                    </div>
                  )}

                  {/* Step: Recap */}
                  {currentStep?.id === "recap" && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">{t("custom.recap")}</h4>
                      <div className="space-y-2">
                        {selectedBase && (
                          <RecapLine
                            label={t("custom.choose_base")}
                            value={selectedBase.name}
                            price={`${Number(selectedBase.price).toFixed(2)} €`}
                            onClick={() => goToStep(steps.findIndex((s) => s.id === "base"))}
                            accent={accent}
                          />
                        )}
                        {selectedViandes.length > 0 && (
                          <RecapLine
                            label={t("custom.choose_meat")}
                            value={selectedViandes.map((v) => v.name).join(", ")}
                            price={selectedViandes.reduce((s, v) => s + Number(v.supplement), 0) > 0
                              ? `+${selectedViandes.reduce((s, v) => s + Number(v.supplement), 0).toFixed(2)} €`
                              : undefined}
                            onClick={() => goToStep(steps.findIndex((s) => s.id === "viande"))}
                            accent={accent}
                          />
                        )}
                        {garnitures.some((g) => garnitureState[g.id]) && (
                          <RecapLine
                            label={t("custom.toppings")}
                            value={garnitures.filter((g) => garnitureState[g.id]).map((g) => g.name).join(", ")}
                            onClick={() => goToStep(steps.findIndex((s) => s.id === "garniture"))}
                            accent={accent}
                          />
                        )}
                        {selectedSauces.length > 0 && (
                          <RecapLine
                            label={t("custom.sauces")}
                            value={selectedSauces.join(", ")}
                            onClick={() => goToStep(steps.findIndex((s) => s.id === "sauce"))}
                            accent={accent}
                          />
                        )}
                        {selectedAccompagnement && (
                          <RecapLine
                            label={t("custom.side")}
                            value={`${selectedAccompagnement.name}${selectedAccompagnement.has_sizes ? ` (${accompSize})` : ""}`}
                            price={isMenu ? undefined : (selectedAccompagnement.has_sizes
                              ? `${Number(selectedAccompagnement[`price_${accompSize}`] ?? 0).toFixed(2)} €`
                              : `${Number(selectedAccompagnement.price_default ?? 0).toFixed(2)} €`)}
                            onClick={() => goToStep(steps.findIndex((s) => s.id === "accompagnement"))}
                            accent={accent}
                          />
                        )}
                        {fritesSauces.length > 0 && (
                          <RecapLine
                            label={t("custom.same_sauce_frites")}
                            value={fritesSauces.join(", ")}
                            price={Math.max(0, fritesSauces.length - freeSaucesFrites) > 0
                              ? `+${(Math.max(0, fritesSauces.length - freeSaucesFrites) * extraSaucePrice).toFixed(2)} €`
                              : undefined}
                            onClick={() => goToStep(steps.findIndex((s) => s.id === "accompagnement"))}
                            accent={accent}
                          />
                        )}
                        {selectedBoisson && (
                          <RecapLine
                            label={t("custom.drink_upsell")}
                            value={selectedBoisson.name}
                            price={isMenu ? undefined : `${selectedBoisson.price.toFixed(2)} €`}
                            onClick={() => goToStep(steps.findIndex((s) => s.id === "boisson"))}
                            accent={accent}
                          />
                        )}
                        {selectedDessert && (
                          <RecapLine
                            label={t("custom.dessert_upsell")}
                            value={selectedDessert.name}
                            price={`${selectedDessert.price.toFixed(2)} €`}
                            onClick={() => goToStep(steps.findIndex((s) => s.id === "dessert"))}
                            accent={accent}
                          />
                        )}
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
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Sticky footer */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100">
              {currentStep?.id === "recap" ? (
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
