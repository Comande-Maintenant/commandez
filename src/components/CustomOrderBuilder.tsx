import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ShoppingBag, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCart } from "@/context/CartContext";
import type { CustomizationConfig, CustomizationStep, DbMenuItem } from "@/types/database";

interface Props {
  config: CustomizationConfig;
  restaurantSlug: string;
  restaurantId: string;
  primaryColor: string;
  primaryLight: string;
  primaryDark: string;
}

export function CustomOrderBuilder({
  config,
  restaurantSlug,
  restaurantId,
  primaryColor,
  primaryLight,
  primaryDark,
}: Props) {
  const { t, language } = useLanguage();
  const { addItem } = useCart();
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [justAdded, setJustAdded] = useState(false);

  const steps = config.steps;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // Translate step title
  const tStepTitle = useCallback(
    (s: CustomizationStep) => {
      if (language === "fr" || !s.title_translations?.[language]) return s.title;
      return s.title_translations[language];
    },
    [language]
  );

  // Translate option name
  const tOptionName = useCallback(
    (opt: { name: string; name_translations?: Record<string, string> }) => {
      if (language === "fr" || !opt.name_translations?.[language]) return opt.name;
      return opt.name_translations[language];
    },
    [language]
  );

  // Calculate total price
  const totalPrice = useMemo(() => {
    let total = config.base_price;
    for (const s of steps) {
      const selected = selections[s.id] || [];
      for (const optId of selected) {
        const opt = s.options.find((o) => o.id === optId);
        if (opt) total += opt.price_modifier;
      }
    }
    return total;
  }, [config, steps, selections]);

  // Toggle an option
  const toggleOption = useCallback(
    (stepDef: CustomizationStep, optionId: string) => {
      setSelections((prev) => {
        const current = prev[stepDef.id] || [];
        if (stepDef.type === "single") {
          return { ...prev, [stepDef.id]: [optionId] };
        }
        // Multiple
        if (current.includes(optionId)) {
          return { ...prev, [stepDef.id]: current.filter((id) => id !== optionId) };
        }
        if (stepDef.max_selections && current.length >= stepDef.max_selections) {
          return prev;
        }
        return { ...prev, [stepDef.id]: [...current, optionId] };
      });
    },
    []
  );

  const isSelected = (stepId: string, optionId: string) =>
    (selections[stepId] || []).includes(optionId);

  // Can advance? Check required steps
  const canAdvance = step.required ? (selections[step.id] || []).length > 0 : true;

  // Build item name from selections (e.g. "Kebab Agneau")
  const buildName = useCallback(() => {
    const parts: string[] = [];
    const baseOpt = selections["base"]?.[0];
    const viandeOpt = selections["viande"]?.[0];
    if (baseOpt) {
      const opt = steps.find((s) => s.id === "base")?.options.find((o) => o.id === baseOpt);
      if (opt) parts.push(opt.name);
    }
    if (viandeOpt) {
      const opt = steps.find((s) => s.id === "viande")?.options.find((o) => o.id === viandeOpt);
      if (opt) parts.push(opt.name);
    }
    return parts.join(" ") || "Kebab personnalise";
  }, [selections, steps]);

  // Build description from garniture, sauce, supplement
  const buildDescription = useCallback(() => {
    const parts: string[] = [];
    for (const s of steps) {
      if (s.id === "base" || s.id === "viande") continue;
      const selected = selections[s.id] || [];
      for (const optId of selected) {
        const opt = s.options.find((o) => o.id === optId);
        if (opt) parts.push(opt.name);
      }
    }
    return parts.join(", ");
  }, [selections, steps]);

  // Add to cart
  const handleAddToCart = useCallback(() => {
    const syntheticItem: DbMenuItem = {
      id: `custom-${Date.now()}`,
      restaurant_id: restaurantId,
      name: buildName(),
      description: buildDescription(),
      price: totalPrice,
      image: "",
      category: "Personnalisation",
      popular: false,
      enabled: true,
      supplements: [],
      sauces: [],
      sort_order: 0,
    };
    addItem(syntheticItem, [], [], restaurantSlug, restaurantId);
    // Reset
    setSelections({});
    setCurrentStep(0);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  }, [addItem, buildName, buildDescription, totalPrice, restaurantSlug, restaurantId]);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-semibold text-gray-900">{t("custom.title")}</h4>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: primaryLight, color: primaryDark }}>
          {t("custom.base_price", { price: config.base_price.toFixed(2) })}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-4">
        {steps.map((s, idx) => (
          <div
            key={s.id}
            className="h-1.5 rounded-full flex-1 transition-all duration-300"
            style={{
              backgroundColor: idx <= currentStep ? primaryColor : `${primaryColor}20`,
            }}
          />
        ))}
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">
          {t("custom.step_of", { current: currentStep + 1, total: steps.length })}
        </span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: step.required ? `${primaryColor}15` : "#f3f4f6",
            color: step.required ? primaryColor : "#6b7280",
          }}
        >
          {step.required ? t("custom.required") : t("custom.optional")}
          {step.max_selections ? ` (${t("custom.max_selections", { max: step.max_selections })})` : ""}
        </span>
      </div>

      {/* Step title */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <h5 className="text-sm font-semibold text-gray-800 mb-3">{tStepTitle(step)}</h5>

          {/* Options grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {step.options.map((opt) => {
              const selected = isSelected(step.id, opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(step, opt.id)}
                  className="relative flex flex-col items-center justify-center p-3 rounded-xl text-center transition-all duration-200 min-h-[64px] border-2"
                  style={{
                    backgroundColor: selected ? primaryColor : primaryLight,
                    borderColor: selected ? primaryColor : "transparent",
                    color: selected ? "#ffffff" : primaryDark,
                  }}
                >
                  {selected && (
                    <div className="absolute top-1.5 right-1.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <span className="text-sm font-medium leading-tight">{tOptionName(opt)}</span>
                  {opt.price_modifier > 0 && (
                    <span className="text-xs mt-1 opacity-80">
                      +{opt.price_modifier.toFixed(2)} \u20ac
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-5 gap-3">
        {currentStep > 0 ? (
          <button
            onClick={() => setCurrentStep((s) => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: primaryLight, color: primaryDark }}
          >
            <ChevronLeft className="h-4 w-4" />
            {t("custom.previous")}
          </button>
        ) : (
          <div />
        )}

        {isLastStep ? (
          <button
            onClick={handleAddToCart}
            disabled={!canAdvance}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            <ShoppingBag className="h-4 w-4" />
            {t("custom.add_to_cart", { price: totalPrice.toFixed(2) })}
          </button>
        ) : (
          <button
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={!canAdvance}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {t("custom.next")}
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Running total */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">{t("custom.your_selection")}</span>
        <span className="text-sm font-bold" style={{ color: primaryColor }}>
          {t("custom.total", { price: totalPrice.toFixed(2) })}
        </span>
      </div>

      {/* Added confirmation */}
      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-3 p-2.5 rounded-xl text-center text-sm font-medium text-white"
            style={{ backgroundColor: "#10b981" }}
          >
            <Check className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            {t("order.confirmed")}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
