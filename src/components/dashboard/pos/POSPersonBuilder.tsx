import { useRef, useCallback, useEffect } from "react";
import { ArrowLeft, Check, Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { CustomizationConfig } from "@/types/database";
import type { POSCustomization, GarnitureLevel } from "@/types/pos";
import { usePOSCustomization } from "./usePOSCustomization";
import { formatPOSOrderSummary } from "@/lib/posHelpers";

interface Props {
  config: CustomizationConfig;
  personIndex: number;
  personLabel: string;
  totalPersons: number;
  existingCustomization?: POSCustomization | null;
  onSave: (customization: POSCustomization, price: number) => void;
  onAddPerson: () => void;
  onGoBoissons: () => void;
  onBack: () => void;
}

export const POSPersonBuilder = ({
  config,
  personIndex,
  personLabel,
  totalPersons,
  existingCustomization,
  onSave,
  onAddPerson,
  onGoBoissons,
  onBack,
}: Props) => {
  const {
    baseId,
    viandeIds,
    garnitures,
    sauceIds,
    accompagnement,
    supplements,
    activeStep,
    price,
    isMultiMeat,
    isStepVisible,
    handleSelectBase,
    handleSelectViande,
    handleGarnitureToggle,
    handleGarnitureComplet,
    handleSelectSauce,
    handleClearSauces,
    handleSelectAccompagnement,
    handleClearAccompagnement,
    handleSetAccompagnementPortion,
    handleSetAccompagnementSubSauce,
    handleSupplementQty,
    advanceStep,
    buildCustomization,
    resetSelections,
  } = usePOSCustomization(config);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const steps = config.steps;

  // Auto-scroll to step
  const scrollToStep = useCallback((stepId: string) => {
    setTimeout(() => {
      sectionRefs.current[stepId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  // Auto-scroll when active step changes
  useEffect(() => {
    const step = steps[activeStep];
    if (step) {
      scrollToStep(step.id);
    }
  }, [activeStep, steps, scrollToStep]);

  const baseStep = steps.find((s) => s.id === "base");
  const viandeStep = steps.find((s) => s.id === "viande");
  const garnitureStep = steps.find((s) => s.id === "garniture");
  const sauceStep = steps.find((s) => s.id === "sauces");
  const accStep = steps.find((s) => s.id === "accompagnement");
  const supStep = steps.find((s) => s.id === "supplements");

  const stepIndexOf = (id: string) => steps.findIndex((s) => s.id === id);

  const hasBase = !!baseId;
  const hasViande = viandeIds.length > 0;
  const hasGarnitures = garnitures.some((g) => g.level !== "non");
  const hasSauces = sauceIds.length > 0;

  // Build recap line
  const recapParts: string[] = [];
  if (hasBase) {
    const baseName = baseStep?.options.find((o) => o.id === baseId)?.name || "";
    const viandeNames = viandeIds.map((id) => viandeStep?.options.find((o) => o.id === id)?.name || "");
    recapParts.push(`${baseName} ${viandeNames.join("+")}`);
  }

  const canFinish = hasBase && hasViande;

  const handleFinishPerson = useCallback(() => {
    const customization = buildCustomization();
    if (customization) {
      onSave(customization, price);
    }
  }, [buildCustomization, price, onSave]);

  const handleAddPersonAndSave = useCallback(() => {
    const customization = buildCustomization();
    if (customization) {
      onSave(customization, price);
      onAddPerson();
    }
  }, [buildCustomization, price, onSave, onAddPerson]);

  const handleGoBoissonsAndSave = useCallback(() => {
    const customization = buildCustomization();
    if (customization) {
      onSave(customization, price);
      onGoBoissons();
    }
  }, [buildCustomization, price, onSave, onGoBoissons]);

  const garnitureLevelStyle = (level: GarnitureLevel) => {
    switch (level) {
      case "non":
        return "bg-card border-border text-muted-foreground";
      case "oui":
        return "bg-foreground text-primary-foreground border-foreground";
      case "x2":
        return "bg-orange-500 text-white border-orange-500";
    }
  };

  const garnitureLevelLabel = (level: GarnitureLevel) => {
    switch (level) {
      case "non": return "";
      case "oui": return "";
      case "x2": return "x2";
    }
  };

  const allGarnituresOui = garnitures.length > 0 && garnitures.every((g) => g.level === "oui");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-[calc(100vh-2rem)] max-h-[900px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-secondary transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="text-lg font-bold text-foreground">{personLabel}</h2>
        <div className="text-sm font-medium text-foreground tabular-nums">
          {price.toFixed(2)} €
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

        {/* === BASE === */}
        {baseStep && (
          <div ref={(el) => { sectionRefs.current["base"] = el; }} className="scroll-mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {baseStep.title}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {baseStep.options.map((opt) => {
                const sel = baseId === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectBase(opt.id)}
                    className={`min-h-[56px] rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.97] ${
                      sel
                        ? "bg-foreground text-primary-foreground border-foreground"
                        : "bg-card text-foreground border-border hover:border-foreground/30"
                    }`}
                  >
                    {opt.name}
                    {opt.price_modifier > 0 && (
                      <span className="block text-xs opacity-70">+{opt.price_modifier.toFixed(2)} €</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* === VIANDE === */}
        {viandeStep && isStepVisible(stepIndexOf("viande")) && (
          <div ref={(el) => { sectionRefs.current["viande"] = el; }} className="scroll-mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {viandeStep.title}
            </h3>
            {isMultiMeat && (
              <p className="text-xs text-muted-foreground mb-3">Multi-viande (max 3)</p>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {viandeStep.options.map((opt) => {
                const sel = viandeIds.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectViande(opt.id)}
                    className={`min-h-[56px] rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.97] ${
                      sel
                        ? "bg-foreground text-primary-foreground border-foreground"
                        : "bg-card text-foreground border-border hover:border-foreground/30"
                    }`}
                  >
                    {opt.name}
                    {opt.price_modifier > 0 && (
                      <span className="block text-xs opacity-70">+{opt.price_modifier.toFixed(2)} €</span>
                    )}
                  </button>
                );
              })}
            </div>
            {isMultiMeat && viandeIds.length > 0 && (
              <button
                onClick={() => {
                  advanceStep();
                }}
                className="mt-3 w-full text-center text-sm font-medium py-2 rounded-xl text-foreground hover:bg-secondary transition-colors"
              >
                Continuer
              </button>
            )}
          </div>
        )}

        {/* === GARNITURE === */}
        {garnitureStep && isStepVisible(stepIndexOf("garniture")) && (
          <div ref={(el) => { sectionRefs.current["garniture"] = el; }} className="scroll-mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {garnitureStep.title}
            </h3>

            {/* Complet shortcut */}
            <button
              onClick={handleGarnitureComplet}
              className={`w-full mb-3 min-h-[48px] rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.97] ${
                allGarnituresOui
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-card text-foreground border-border hover:border-green-600/50"
              }`}
            >
              {allGarnituresOui ? (
                <span className="flex items-center justify-center gap-2">
                  <Check className="h-4 w-4" />Complet
                </span>
              ) : (
                "Complet"
              )}
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {garnitures.map((g) => (
                <button
                  key={g.optionId}
                  onClick={() => handleGarnitureToggle(g.optionId)}
                  className={`relative min-h-[48px] rounded-xl border-2 text-sm font-medium transition-all active:scale-[0.97] ${garnitureLevelStyle(g.level)}`}
                >
                  {g.name}
                  {g.level === "x2" && (
                    <span className="absolute top-1 right-1.5 text-[10px] font-bold bg-white/20 rounded px-1">x2</span>
                  )}
                  {g.level === "oui" && (
                    <span className="absolute top-1 right-1.5">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={advanceStep}
              className="mt-3 w-full text-center text-sm font-medium py-2 rounded-xl text-foreground hover:bg-secondary transition-colors"
            >
              Continuer
            </button>
          </div>
        )}

        {/* === SAUCES === */}
        {sauceStep && isStepVisible(stepIndexOf("sauces")) && (
          <div ref={(el) => { sectionRefs.current["sauces"] = el; }} className="scroll-mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {sauceStep.title}
              {sauceStep.max_selections && (
                <span className="ml-2 text-xs font-normal">(max {sauceStep.max_selections})</span>
              )}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sauceStep.options.map((opt) => {
                const sel = sauceIds.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectSauce(opt.id)}
                    className={`min-h-[48px] rounded-xl border-2 text-sm font-medium transition-all active:scale-[0.97] ${
                      sel
                        ? "bg-foreground text-primary-foreground border-foreground"
                        : "bg-card text-foreground border-border hover:border-foreground/30"
                    }`}
                  >
                    {opt.name}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { handleClearSauces(); advanceStep(); }}
                className="flex-1 text-center text-sm font-medium py-2 rounded-xl text-muted-foreground hover:bg-secondary transition-colors"
              >
                Sans sauce
              </button>
              <button
                onClick={advanceStep}
                className="flex-1 text-center text-sm font-medium py-2 rounded-xl text-foreground hover:bg-secondary transition-colors"
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* === ACCOMPAGNEMENT === */}
        {accStep && isStepVisible(stepIndexOf("accompagnement")) && (
          <div ref={(el) => { sectionRefs.current["accompagnement"] = el; }} className="scroll-mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {accStep.title}
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {accStep.options.map((opt) => {
                const sel = accompagnement?.optionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectAccompagnement(opt.id)}
                    className={`min-h-[56px] rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.97] ${
                      sel
                        ? "bg-foreground text-primary-foreground border-foreground"
                        : "bg-card text-foreground border-border hover:border-foreground/30"
                    }`}
                  >
                    {opt.name}
                    {opt.price_modifier > 0 && (
                      <span className="block text-xs opacity-70">+{opt.price_modifier.toFixed(2)} €</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Portion options */}
            {accompagnement && (
              <div className="mt-3 space-y-3">
                {/* Portion size */}
                {(() => {
                  const opt = accStep.options.find((o) => o.id === accompagnement.optionId);
                  if (!opt?.portion_options || opt.portion_options.length === 0) return null;
                  return (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Portion</p>
                      <div className="flex gap-2">
                        {opt.portion_options.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSetAccompagnementPortion(p.id as "normale" | "double")}
                            className={`flex-1 min-h-[44px] rounded-xl border-2 text-sm font-medium transition-all ${
                              accompagnement.portion === p.id
                                ? "bg-foreground text-primary-foreground border-foreground"
                                : "bg-card text-foreground border-border"
                            }`}
                          >
                            {p.label}
                            {p.price_modifier > 0 && (
                              <span className="block text-xs opacity-70">+{p.price_modifier.toFixed(2)} €</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Sub-sauce for accompagnement */}
                {(() => {
                  const opt = accStep.options.find((o) => o.id === accompagnement.optionId);
                  if (!opt?.has_sub_sauce) return null;
                  // Use sauce step options as sub-sauce choices
                  const subSauceOptions = sauceStep?.options || [];
                  return (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Sauce accompagnement</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {subSauceOptions.map((s) => {
                          const sel = accompagnement.subSauceId === s.id;
                          return (
                            <button
                              key={s.id}
                              onClick={() => handleSetAccompagnementSubSauce(s.id, s.name)}
                              className={`min-h-[40px] rounded-xl border-2 text-xs font-medium transition-all ${
                                sel
                                  ? "bg-foreground text-primary-foreground border-foreground"
                                  : "bg-card text-foreground border-border"
                              }`}
                            >
                              {s.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { handleClearAccompagnement(); advanceStep(); }}
                className="flex-1 text-center text-sm font-medium py-2 rounded-xl text-muted-foreground hover:bg-secondary transition-colors"
              >
                Sans accompagnement
              </button>
              {accompagnement && (
                <button
                  onClick={advanceStep}
                  className="flex-1 text-center text-sm font-medium py-2 rounded-xl text-foreground hover:bg-secondary transition-colors"
                >
                  Continuer
                </button>
              )}
            </div>
          </div>
        )}

        {/* === SUPPLEMENTS === */}
        {supStep && isStepVisible(stepIndexOf("supplements")) && (
          <div ref={(el) => { sectionRefs.current["supplements"] = el; }} className="scroll-mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {supStep.title}
            </h3>

            <div className="space-y-2">
              {supplements.map((sup) => (
                <div
                  key={sup.optionId}
                  className={`flex items-center justify-between rounded-xl border-2 px-4 min-h-[48px] transition-all ${
                    sup.quantity > 0
                      ? "border-foreground bg-foreground/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div>
                    <span className="text-sm font-medium text-foreground">{sup.name}</span>
                    {sup.unitPrice > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">+{sup.unitPrice.toFixed(2)} €</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSupplementQty(sup.optionId, -1)}
                      className="p-1.5 rounded-full hover:bg-secondary transition-colors disabled:opacity-30"
                      disabled={sup.quantity === 0}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-bold w-4 text-center">{sup.quantity}</span>
                    <button
                      onClick={() => handleSupplementQty(sup.optionId, 1)}
                      className="p-1.5 rounded-full hover:bg-secondary transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                // No-op, supplements is the last customization step
              }}
              className="mt-3 w-full text-center text-sm font-medium py-2 rounded-xl text-muted-foreground hover:bg-secondary transition-colors"
            >
              Pas de supplement
            </button>
          </div>
        )}

        {/* Spacer for bottom actions */}
        <div className="h-4" />
      </div>

      {/* Bottom recap + actions */}
      {canFinish && (
        <div className="border-t border-border bg-background px-4 py-3 space-y-3">
          {/* Mini recap */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-foreground truncate flex-1 mr-3">
              {recapParts.join(", ")}
            </div>
            <span className="text-lg font-bold text-foreground tabular-nums">{price.toFixed(2)} €</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl min-h-[48px] text-sm font-semibold"
              onClick={handleAddPersonAndSave}
            >
              + Personne
            </Button>
            <Button
              className="flex-1 rounded-xl min-h-[48px] text-sm font-semibold"
              onClick={handleGoBoissonsAndSave}
            >
              Boissons &gt;
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
