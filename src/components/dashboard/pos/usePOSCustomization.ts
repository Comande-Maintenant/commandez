import { useState, useMemo, useCallback } from "react";
import type { CustomizationConfig, CustomizationStep } from "@/types/database";
import type {
  POSCustomization,
  POSGarnitureChoice,
  POSAccompagnement,
  POSSupplement,
  GarnitureLevel,
} from "@/types/pos";
import { calculateCustomizationPrice } from "@/lib/posHelpers";

interface UsePOSCustomizationReturn {
  // Selections
  baseId: string | null;
  viandeIds: string[];
  garnitures: POSGarnitureChoice[];
  sauceIds: string[];
  accompagnement: POSAccompagnement | null;
  supplements: POSSupplement[];

  // Derived
  activeStep: number;
  price: number;
  isMultiMeat: boolean;
  isStepVisible: (stepIndex: number) => boolean;

  // Actions
  handleSelectBase: (optionId: string) => void;
  handleSelectViande: (optionId: string) => void;
  handleGarnitureToggle: (optionId: string) => void;
  handleGarnitureComplet: () => void;
  handleSelectSauce: (optionId: string) => void;
  handleClearSauces: () => void;
  handleSelectAccompagnement: (optionId: string) => void;
  handleClearAccompagnement: () => void;
  handleSetAccompagnementPortion: (portion: "normale" | "double") => void;
  handleSetAccompagnementSubSauce: (sauceId: string, sauceName: string) => void;
  handleSupplementQty: (optionId: string, delta: number) => void;
  advanceStep: () => void;
  buildCustomization: () => POSCustomization | null;
  resetSelections: () => void;
}

export function usePOSCustomization(config: CustomizationConfig | null): UsePOSCustomizationReturn {
  const steps = config?.steps || [];

  const [baseId, setBaseId] = useState<string | null>(null);
  const [viandeIds, setViandeIds] = useState<string[]>([]);
  const [garnitures, setGarnitures] = useState<POSGarnitureChoice[]>([]);
  const [sauceIds, setSauceIds] = useState<string[]>([]);
  const [accompagnement, setAccompagnement] = useState<POSAccompagnement | null>(null);
  const [supplements, setSupplements] = useState<POSSupplement[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  // Check if current base allows multi-meat (tacos)
  const isMultiMeat = useMemo(() => {
    if (!baseId) return false;
    const baseStep = steps.find((s) => s.id === "base");
    if (!baseStep) return false;
    const baseOpt = baseStep.options.find((o) => o.id === baseId);
    return !!baseOpt?.allow_multi_meat;
  }, [baseId, steps]);

  // Initialize garnitures from config when step becomes relevant
  const initGarnitures = useCallback(() => {
    const garnitureStep = steps.find((s) => s.id === "garniture");
    if (!garnitureStep) return;
    setGarnitures(
      garnitureStep.options.map((opt) => ({
        optionId: opt.id,
        name: opt.name,
        level: "non" as GarnitureLevel,
      }))
    );
  }, [steps]);

  // Initialize supplements from config
  const initSupplements = useCallback(() => {
    const supStep = steps.find((s) => s.id === "supplements");
    if (!supStep) return;
    setSupplements(
      supStep.options.map((opt) => ({
        optionId: opt.id,
        name: opt.name,
        quantity: 0,
        unitPrice: opt.price_modifier,
      }))
    );
  }, [steps]);

  const getOptionName = useCallback(
    (stepId: string, optionId: string): string => {
      const step = steps.find((s) => s.id === stepId);
      return step?.options.find((o) => o.id === optionId)?.name || "";
    },
    [steps]
  );

  // Calculate price
  const price = useMemo(() => {
    if (!config || !baseId) return config?.base_price || 0;
    const customization = buildCustomizationInternal();
    if (!customization) return config.base_price;
    return calculateCustomizationPrice(config, customization);
  }, [config, baseId, viandeIds, garnitures, sauceIds, accompagnement, supplements]);

  function buildCustomizationInternal(): POSCustomization | null {
    if (!baseId) return null;
    return {
      baseId,
      baseName: getOptionName("base", baseId),
      viandeIds,
      viandeNames: viandeIds.map((id) => getOptionName("viande", id)),
      garnitures,
      sauceIds,
      sauceNames: sauceIds.map((id) => getOptionName("sauces", id)),
      accompagnement,
      supplements: supplements.filter((s) => s.quantity > 0),
    };
  }

  const handleSelectBase = useCallback(
    (optionId: string) => {
      if (baseId === optionId) {
        setBaseId(null);
        return;
      }
      setBaseId(optionId);

      // Check if new base allows multi-meat
      const baseStep = steps.find((s) => s.id === "base");
      const newBaseOpt = baseStep?.options.find((o) => o.id === optionId);
      const wasMulti = isMultiMeat;
      const nowMulti = !!newBaseOpt?.allow_multi_meat;

      // If switching from multi to single, truncate viande to 1
      if (wasMulti && !nowMulti && viandeIds.length > 1) {
        setViandeIds([viandeIds[0]]);
      }

      // Auto-advance
      const baseStepIdx = steps.findIndex((s) => s.id === "base");
      if (baseStepIdx >= 0 && baseStepIdx + 1 < steps.length) {
        setActiveStep(baseStepIdx + 1);
      }
    },
    [baseId, steps, isMultiMeat, viandeIds]
  );

  const handleSelectViande = useCallback(
    (optionId: string) => {
      if (isMultiMeat) {
        // Multi-select (max 3)
        setViandeIds((prev) => {
          if (prev.includes(optionId)) {
            return prev.filter((id) => id !== optionId);
          }
          if (prev.length >= 3) return prev;
          return [...prev, optionId];
        });
      } else {
        // Single-select toggle
        setViandeIds((prev) => {
          if (prev[0] === optionId) return [];
          return [optionId];
        });
        // Auto-advance on single select
        if (viandeIds[0] !== optionId) {
          const viandeStepIdx = steps.findIndex((s) => s.id === "viande");
          if (viandeStepIdx >= 0 && viandeStepIdx + 1 < steps.length) {
            setActiveStep(viandeStepIdx + 1);
            // Init garnitures
            initGarnitures();
          }
        }
      }
    },
    [isMultiMeat, viandeIds, steps, initGarnitures]
  );

  const handleGarnitureToggle = useCallback(
    (optionId: string) => {
      setGarnitures((prev) =>
        prev.map((g) => {
          if (g.optionId !== optionId) return g;
          // Cycle: non -> oui -> x2 -> non
          const nextLevel: GarnitureLevel =
            g.level === "non" ? "oui" : g.level === "oui" ? "x2" : "non";
          return { ...g, level: nextLevel };
        })
      );
    },
    []
  );

  const handleGarnitureComplet = useCallback(() => {
    setGarnitures((prev) => {
      const allOui = prev.every((g) => g.level === "oui");
      if (allOui) {
        // Toggle off
        return prev.map((g) => ({ ...g, level: "non" as GarnitureLevel }));
      }
      // Set all to oui
      return prev.map((g) => ({ ...g, level: "oui" as GarnitureLevel }));
    });
  }, []);

  const handleSelectSauce = useCallback(
    (optionId: string) => {
      setSauceIds((prev) => {
        if (prev.includes(optionId)) {
          return prev.filter((id) => id !== optionId);
        }
        const sauceStep = steps.find((s) => s.id === "sauces");
        const max = sauceStep?.max_selections || 3;
        if (prev.length >= max) return prev;
        return [...prev, optionId];
      });
    },
    [steps]
  );

  const handleClearSauces = useCallback(() => {
    setSauceIds([]);
  }, []);

  const handleSelectAccompagnement = useCallback(
    (optionId: string) => {
      if (accompagnement?.optionId === optionId) {
        setAccompagnement(null);
        return;
      }
      const accStep = steps.find((s) => s.id === "accompagnement");
      const opt = accStep?.options.find((o) => o.id === optionId);
      if (!opt) return;
      setAccompagnement({
        optionId,
        name: opt.name,
        portion: "normale",
        portionPriceMod: 0,
        subSauceId: undefined,
        subSauceName: undefined,
      });
    },
    [accompagnement, steps]
  );

  const handleClearAccompagnement = useCallback(() => {
    setAccompagnement(null);
  }, []);

  const handleSetAccompagnementPortion = useCallback(
    (portion: "normale" | "double") => {
      if (!accompagnement) return;
      const accStep = steps.find((s) => s.id === "accompagnement");
      const opt = accStep?.options.find((o) => o.id === accompagnement.optionId);
      const portionOpts = opt?.portion_options || [];
      const portionDef = portionOpts.find((p) => p.id === portion);
      setAccompagnement({
        ...accompagnement,
        portion,
        portionPriceMod: portionDef?.price_modifier || 0,
      });
    },
    [accompagnement, steps]
  );

  const handleSetAccompagnementSubSauce = useCallback(
    (sauceId: string, sauceName: string) => {
      if (!accompagnement) return;
      setAccompagnement({
        ...accompagnement,
        subSauceId: accompagnement.subSauceId === sauceId ? undefined : sauceId,
        subSauceName: accompagnement.subSauceId === sauceId ? undefined : sauceName,
      });
    },
    [accompagnement]
  );

  const handleSupplementQty = useCallback(
    (optionId: string, delta: number) => {
      const supStep = steps.find((s) => s.id === "supplements");
      const maxQty = supStep?.max_qty_per_option || 3;
      setSupplements((prev) =>
        prev.map((s) => {
          if (s.optionId !== optionId) return s;
          const newQty = Math.max(0, Math.min(maxQty, s.quantity + delta));
          return { ...s, quantity: newQty };
        })
      );
    },
    [steps]
  );

  const advanceStep = useCallback(() => {
    setActiveStep((prev) => {
      const next = prev + 1;
      // Initialize garnitures when entering garniture step
      const nextStep = steps[next];
      if (nextStep?.id === "garniture" && garnitures.length === 0) {
        initGarnitures();
      }
      if (nextStep?.id === "supplements" && supplements.length === 0) {
        initSupplements();
      }
      return Math.min(next, steps.length);
    });
  }, [steps, garnitures.length, supplements.length, initGarnitures, initSupplements]);

  const isStepVisible = useCallback(
    (stepIndex: number) => stepIndex <= activeStep,
    [activeStep]
  );

  const buildCustomization = useCallback((): POSCustomization | null => {
    return buildCustomizationInternal();
  }, [baseId, viandeIds, garnitures, sauceIds, accompagnement, supplements, getOptionName]);

  const resetSelections = useCallback(() => {
    setBaseId(null);
    setViandeIds([]);
    setGarnitures([]);
    setSauceIds([]);
    setAccompagnement(null);
    setSupplements([]);
    setActiveStep(0);
  }, []);

  return {
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
  };
}
