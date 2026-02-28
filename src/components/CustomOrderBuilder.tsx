import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Check, ChevronDown } from "lucide-react";
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
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [activeStep, setActiveStep] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const stepRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const cartRef = useRef<HTMLDivElement | null>(null);

  const steps = config.steps;

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

  // Check if step is completed
  const isStepCompleted = useCallback(
    (idx: number) => {
      const s = steps[idx];
      const selected = selections[s.id] || [];
      if (s.required) return selected.length > 0;
      // Optional steps are "completed" if we've moved past them
      return idx < activeStep;
    },
    [steps, selections, activeStep]
  );

  // Check if all required steps are done
  const allRequiredDone = useMemo(() => {
    return steps.every((s, idx) => {
      if (!s.required) return true;
      return (selections[s.id] || []).length > 0;
    });
  }, [steps, selections]);

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

  // Scroll to a step
  const scrollToStep = useCallback((idx: number) => {
    setTimeout(() => {
      stepRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  // Scroll to cart button
  const scrollToCart = useCallback(() => {
    setTimeout(() => {
      cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  // Toggle an option
  const handleSelect = useCallback(
    (stepIdx: number, stepDef: CustomizationStep, optionId: string) => {
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

      // Single-select: auto-advance to next step
      if (stepDef.type === "single") {
        const nextIdx = stepIdx + 1;
        if (nextIdx < steps.length) {
          setActiveStep(nextIdx);
          scrollToStep(nextIdx);
        } else {
          // Last step, scroll to cart
          scrollToCart();
        }
      }
    },
    [steps, scrollToStep, scrollToCart]
  );

  // "Continuer" for multi-select steps
  const handleContinue = useCallback(
    (stepIdx: number) => {
      const nextIdx = stepIdx + 1;
      if (nextIdx < steps.length) {
        setActiveStep(nextIdx);
        scrollToStep(nextIdx);
      } else {
        scrollToCart();
      }
    },
    [steps, scrollToStep, scrollToCart]
  );

  const isSelected = (stepId: string, optionId: string) =>
    (selections[stepId] || []).includes(optionId);

  // Build summary text for a completed step
  const getStepSummary = useCallback(
    (s: CustomizationStep) => {
      const selected = selections[s.id] || [];
      if (selected.length === 0) return null;
      return selected
        .map((optId) => {
          const opt = s.options.find((o) => o.id === optId);
          return opt ? tOptionName(opt) : "";
        })
        .filter(Boolean)
        .join(", ");
    },
    [selections, tOptionName]
  );

  // Build item name from selections
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
    setSelections({});
    setActiveStep(0);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  }, [addItem, buildName, buildDescription, totalPrice, restaurantSlug, restaurantId]);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-semibold text-gray-900">{t("custom.title")}</h4>
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ backgroundColor: primaryLight, color: primaryDark }}
        >
          {t("custom.base_price", { price: config.base_price.toFixed(2) })}
        </span>
      </div>

      {/* All steps */}
      <div className="space-y-3">
        {steps.map((s, idx) => {
          const completed = isStepCompleted(idx);
          const isCurrent = idx === activeStep;
          const summary = getStepSummary(s);
          const selected = selections[s.id] || [];
          const isPast = idx < activeStep;
          const isFuture = idx > activeStep;

          return (
            <div
              key={s.id}
              ref={(el) => { stepRefs.current[idx] = el; }}
              className="scroll-mt-4"
            >
              {/* Completed step: collapsed summary */}
              {completed && !isCurrent ? (
                <button
                  onClick={() => setActiveStep(idx)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors hover:bg-gray-50"
                >
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-sm text-gray-500">{tStepTitle(s)}</span>
                  <span className="text-sm font-medium text-gray-900 truncate flex-1 text-left ml-1">
                    {summary}
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </button>
              ) : (
                /* Active or future step: expanded */
                <div
                  className={`rounded-xl border transition-all ${
                    isCurrent
                      ? "border-gray-200 bg-white"
                      : "border-gray-100 bg-gray-50/50 opacity-50"
                  }`}
                  style={isCurrent ? { borderColor: `${primaryColor}30` } : undefined}
                >
                  <div className="px-3 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{
                          backgroundColor: isCurrent ? primaryColor : "#e5e7eb",
                          color: isCurrent ? "#ffffff" : "#9ca3af",
                        }}
                      >
                        {idx + 1}
                      </div>
                      <span className={`text-sm font-semibold ${isCurrent ? "text-gray-900" : "text-gray-400"}`}>
                        {tStepTitle(s)}
                      </span>
                    </div>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: s.required && isCurrent ? `${primaryColor}15` : "#f3f4f6",
                        color: s.required && isCurrent ? primaryColor : "#9ca3af",
                      }}
                    >
                      {s.required ? t("custom.required") : t("custom.optional")}
                    </span>
                  </div>

                  {/* Options grid - only for current step */}
                  {isCurrent && (
                    <div className="px-3 pb-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {s.options.map((opt) => {
                          const sel = isSelected(s.id, opt.id);
                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleSelect(idx, s, opt.id)}
                              className="relative flex flex-col items-center justify-center p-3 rounded-xl text-center transition-all duration-200 min-h-[64px] border-2"
                              style={{
                                backgroundColor: sel ? primaryColor : primaryLight,
                                borderColor: sel ? primaryColor : "transparent",
                                color: sel ? "#ffffff" : primaryDark,
                              }}
                            >
                              {sel && (
                                <div className="absolute top-1.5 right-1.5">
                                  <Check className="h-3.5 w-3.5" />
                                </div>
                              )}
                              <span className="text-sm font-medium leading-tight">{tOptionName(opt)}</span>
                              {opt.price_modifier > 0 && (
                                <span className="text-xs mt-1 opacity-80">
                                  +{opt.price_modifier.toFixed(2)} €
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Multi-select: continue link */}
                      {s.type === "multiple" && (
                        <button
                          onClick={() => handleContinue(idx)}
                          className="mt-3 w-full text-center text-sm font-medium py-2 rounded-xl transition-colors"
                          style={{ color: primaryColor }}
                        >
                          {selected.length === 0
                            ? (s.id === "sauces" ? "Pas de sauce" : s.id === "supplements" ? "Pas de supplement" : "Passer")
                            : "Continuer"
                          }
                          {" "}
                          <ChevronDown className="inline h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cart section - visible when required steps are done */}
      <div ref={cartRef} className="scroll-mt-4">
        {allRequiredDone && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 pt-4 border-t border-gray-100"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{t("custom.your_selection")}</span>
              <span className="text-base font-bold" style={{ color: primaryColor }}>
                {t("custom.total", { price: totalPrice.toFixed(2) })}
              </span>
            </div>
            <button
              onClick={handleAddToCart}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97]"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingBag className="h-4 w-4" />
              {t("custom.add_to_cart", { price: totalPrice.toFixed(2) })}
            </button>
          </motion.div>
        )}
      </div>

      {/* Running total - always visible at bottom */}
      {!allRequiredDone && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">{t("custom.your_selection")}</span>
          <span className="text-sm font-bold" style={{ color: primaryColor }}>
            {t("custom.total", { price: totalPrice.toFixed(2) })}
          </span>
        </div>
      )}

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
