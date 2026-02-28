import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Check, ChevronDown, ChevronRight } from "lucide-react";
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

  // Check if selected base allows multi-meat (tacos)
  const isMultiMeat = useMemo(() => {
    const baseStep = steps.find((s) => s.id === "base");
    const baseId = selections["base"]?.[0];
    if (!baseStep || !baseId) return false;
    const baseOpt = baseStep.options.find((o) => o.id === baseId);
    return baseOpt?.allow_multi_meat === true;
  }, [steps, selections]);

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

  // Check if step has its required condition met
  const isStepFulfilled = useCallback(
    (idx: number) => {
      const s = steps[idx];
      const selected = selections[s.id] || [];
      if (s.required) return selected.length > 0;
      return true; // optional steps are always fulfillable
    },
    [steps, selections]
  );

  // Check if step is completed (fulfilled AND we've moved past it)
  const isStepCompleted = useCallback(
    (idx: number) => {
      const s = steps[idx];
      const selected = selections[s.id] || [];
      if (s.required) return selected.length > 0 && idx < activeStep;
      return idx < activeStep;
    },
    [steps, selections, activeStep]
  );

  // Check if all required steps are done
  const allRequiredDone = useMemo(() => {
    return steps.every((s) => {
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

  // Advance to next step
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

  // Handle option selection
  const handleSelect = useCallback(
    (stepIdx: number, stepDef: CustomizationStep, optionId: string) => {
      // Special case: viande with multi-meat (tacos)
      if (stepDef.type === "single_or_multi" && isMultiMeat) {
        setSelections((prev) => {
          const current = prev[stepDef.id] || [];
          // If clicking an already-selected option, remove it
          if (current.includes(optionId)) {
            return { ...prev, [stepDef.id]: current.filter((id) => id !== optionId) };
          }
          // Max 3 meats
          if (current.length >= (stepDef.max_selections || 3)) return prev;
          return { ...prev, [stepDef.id]: [...current, optionId] };
        });
        // No auto-advance for multi-meat, user uses "Continuer" button
        return;
      }

      // single_or_multi without multi-meat: behave as single
      if (stepDef.type === "single" || stepDef.type === "single_or_multi") {
        setSelections((prev) => ({ ...prev, [stepDef.id]: [optionId] }));
        // Auto-advance
        const nextIdx = stepIdx + 1;
        if (nextIdx < steps.length) {
          setActiveStep(nextIdx);
          scrollToStep(nextIdx);
        } else {
          scrollToCart();
        }
        return;
      }

      // Multiple / custom_garniture / multiple_with_quantity
      setSelections((prev) => {
        const current = prev[stepDef.id] || [];
        if (current.includes(optionId)) {
          return { ...prev, [stepDef.id]: current.filter((id) => id !== optionId) };
        }
        if (stepDef.max_selections && current.length >= stepDef.max_selections) {
          return prev;
        }
        return { ...prev, [stepDef.id]: [...current, optionId] };
      });
    },
    [steps, isMultiMeat, scrollToStep, scrollToCart]
  );

  const isOptionSelected = (stepId: string, optionId: string) =>
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
    const viandeOpts = selections["viande"] || [];
    if (baseOpt) {
      const opt = steps.find((s) => s.id === "base")?.options.find((o) => o.id === baseOpt);
      if (opt) parts.push(opt.name);
    }
    if (viandeOpts.length > 0) {
      const viandeStep = steps.find((s) => s.id === "viande");
      const names = viandeOpts.map((id) => viandeStep?.options.find((o) => o.id === id)?.name).filter(Boolean);
      parts.push(names.join("/"));
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

  // Render options grid
  const renderOptionsGrid = (s: CustomizationStep, stepIdx: number) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {s.options.map((opt) => {
        const sel = isOptionSelected(s.id, opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => handleSelect(stepIdx, s, opt.id)}
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
  );

  // Render the "Continuer" button for a step
  const renderContinueButton = (stepIdx: number, stepDef: CustomizationStep) => {
    const fulfilled = isStepFulfilled(stepIdx);
    const selected = selections[stepDef.id] || [];
    const isLast = stepIdx === steps.length - 1;

    // Skip label for optional empty steps
    const skipLabel = stepDef.skip_label || (stepDef.id === "sauces" ? "Pas de sauce" : stepDef.id === "supplements" ? "Pas de supplement" : "Passer");

    if (stepDef.required && !fulfilled) {
      return (
        <div className="mt-3 w-full text-center text-sm font-medium py-2.5 rounded-xl text-gray-400 bg-gray-100">
          Selectionnez d'abord
        </div>
      );
    }

    const label = !stepDef.required && selected.length === 0
      ? skipLabel
      : isLast ? "Terminer" : "Continuer";

    return (
      <button
        onClick={() => handleContinue(stepIdx)}
        className="mt-3 w-full text-center text-sm font-medium py-2.5 rounded-xl transition-colors"
        style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}
      >
        {label} <ChevronRight className="inline h-3.5 w-3.5 ml-0.5" />
      </button>
    );
  };

  // Render viande step with multi-meat slots for tacos
  const renderMultiMeatStep = (s: CustomizationStep, stepIdx: number) => {
    const selected = selections[s.id] || [];
    const maxMeats = s.max_selections || 3;

    return (
      <div className="px-3 pb-3 space-y-4">
        {/* Render a slot for each meat (1, 2, 3) */}
        {Array.from({ length: Math.min(selected.length + 1, maxMeats) }).map((_, slotIdx) => {
          const slotMeatId = selected[slotIdx];
          const slotMeatOpt = slotMeatId ? s.options.find((o) => o.id === slotMeatId) : null;
          const isSlotFilled = !!slotMeatOpt;
          const isActiveSlot = slotIdx === selected.length; // The next unfilled slot

          return (
            <div key={slotIdx}>
              {/* Slot header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-900">
                  Viande {slotIdx + 1}
                </span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: slotIdx === 0 ? `${primaryColor}15` : "#f3f4f6",
                    color: slotIdx === 0 ? primaryColor : "#9ca3af",
                  }}
                >
                  {slotIdx === 0 ? "obligatoire" : "optionnel"}
                </span>
                {isSlotFilled && (
                  <span className="text-sm font-medium ml-auto" style={{ color: primaryColor }}>
                    {tOptionName(slotMeatOpt!)}
                    {slotMeatOpt!.price_modifier > 0 && ` (+${slotMeatOpt!.price_modifier.toFixed(2)} €)`}
                  </span>
                )}
              </div>

              {/* Show grid only for the active (unfilled) slot */}
              {!isSlotFilled && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {s.options.map((opt) => {
                    // Don't show already-selected meats
                    const alreadyPicked = selected.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelect(stepIdx, s, opt.id)}
                        disabled={alreadyPicked}
                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl text-center transition-all duration-200 min-h-[64px] border-2 ${alreadyPicked ? "opacity-30 cursor-not-allowed" : ""}`}
                        style={{
                          backgroundColor: primaryLight,
                          borderColor: "transparent",
                          color: primaryDark,
                        }}
                      >
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
              )}
            </div>
          );
        })}

        {/* Continue button: visible once viande 1 is selected */}
        {selected.length > 0 && renderContinueButton(stepIdx, s)}
      </div>
    );
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.3)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
      }}
    >
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
          const isFuture = idx > activeStep;

          // Is this the viande step in multi-meat mode?
          const isMultiMeatViande = s.type === "single_or_multi" && isMultiMeat;

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

                  {/* Options - only for current step */}
                  {isCurrent && (
                    <>
                      {isMultiMeatViande ? (
                        renderMultiMeatStep(s, idx)
                      ) : (
                        <div className="px-3 pb-3">
                          {renderOptionsGrid(s, idx)}
                          {/* Continue button for non-single-select steps */}
                          {s.type !== "single" && s.type !== "single_or_multi" && (
                            renderContinueButton(idx, s)
                          )}
                          {/* For single_or_multi (non-tacos) treated as single: show continue if fulfilled */}
                          {s.type === "single_or_multi" && !isMultiMeat && selected.length > 0 && (
                            renderContinueButton(idx, s)
                          )}
                        </div>
                      )}
                    </>
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
