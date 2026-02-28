import { useState, useMemo } from "react";
import { X, Minus, Plus, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DbMenuItem, Supplement, CustomizationConfig, CustomizationOption } from "@/types/database";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  item: DbMenuItem;
  open: boolean;
  onClose: () => void;
  restaurantSlug: string;
  restaurantId: string;
  customizationConfig: CustomizationConfig;
  primaryColor: string;
}

const NON_SAVORY_KEYWORDS = ["dessert", "boisson", "drink", "sucre", "sweet", "glace", "patisserie", "cookie", "gateau"];

export const isSavoryItem = (category: string) => {
  const cat = category.toLowerCase();
  return !NON_SAVORY_KEYWORDS.some((k) => cat.includes(k));
};

export const hasMeatInName = (name: string, viandeOptions: CustomizationOption[]) => {
  const n = name.toLowerCase();
  return viandeOptions.some((opt) => n.includes(opt.name.toLowerCase()));
};

type GarnitureLevel = "non" | "oui" | "x2";

export const SavoryItemDrawer = ({
  item,
  open,
  onClose,
  restaurantSlug,
  restaurantId,
  customizationConfig,
  primaryColor,
}: Props) => {
  const { addItem } = useCart();
  const { t, tMenu } = useLanguage();
  const accent = primaryColor || "#FF6B00";
  const translated = tMenu(item);

  const viandeStep = customizationConfig.steps.find((s) => s.id === "viande");
  const garnitureStep = customizationConfig.steps.find((s) => s.id === "garniture");
  const saucesStep = customizationConfig.steps.find((s) => s.id === "sauces");

  const skipViande = viandeStep ? hasMeatInName(item.name, viandeStep.options) : true;
  const isTacos = item.name.toLowerCase().includes("tacos");

  const [viandeSelection, setViandeSelection] = useState<string[]>([]);
  const [garniture, setGarniture] = useState<Record<string, GarnitureLevel>>({});
  const [selectedSauces, setSelectedSauces] = useState<string[]>([]);
  const [selectedSupplements, setSelectedSupplements] = useState<Supplement[]>([]);
  const [quantity, setQuantity] = useState(1);

  // Sauces: use config step or fallback to item.sauces
  const availableSauces = saucesStep
    ? saucesStep.options.map((o) => o.name)
    : item.sauces;

  // Viande cost
  const viandeCost = useMemo(() => {
    if (!viandeStep || skipViande) return 0;
    return viandeSelection.reduce((sum, id) => {
      const opt = viandeStep.options.find((o) => o.id === id);
      return sum + (opt?.price_modifier || 0);
    }, 0);
  }, [viandeSelection, viandeStep, skipViande]);

  // Garniture x2 cost
  const garnitureCost = useMemo(() => {
    if (!garnitureStep) return 0;
    return Object.entries(garniture).reduce((sum, [optId, level]) => {
      if (level === "x2") {
        const opt = garnitureStep.options.find((o) => o.id === optId);
        return sum + (opt?.price_modifier || 0);
      }
      return sum;
    }, 0);
  }, [garniture, garnitureStep]);

  // Supplements cost
  const suppCost = useMemo(
    () => selectedSupplements.reduce((sum, s) => sum + s.price, 0),
    [selectedSupplements]
  );

  const unitPrice = item.price + viandeCost + garnitureCost + suppCost;
  const total = unitPrice * quantity;

  // Viande selection
  const toggleViande = (optId: string) => {
    if (isTacos) {
      setViandeSelection((prev) => {
        if (prev.includes(optId)) {
          return prev.filter((id) => id !== optId);
        }
        if (prev.length < 3) return [...prev, optId];
        return prev;
      });
    } else {
      setViandeSelection((prev) => (prev[0] === optId ? [] : [optId]));
    }
  };

  // Garniture 3-state cycle
  const cycleGarniture = (optId: string) => {
    setGarniture((prev) => {
      const current = prev[optId] || "non";
      const next: GarnitureLevel =
        current === "non" ? "oui" : current === "oui" ? "x2" : "non";
      return { ...prev, [optId]: next };
    });
  };

  // "Complet" shortcut
  const handleComplet = () => {
    if (!garnitureStep) return;
    const all: Record<string, GarnitureLevel> = {};
    garnitureStep.options.forEach((opt) => {
      all[opt.id] = "oui";
    });
    setGarniture(all);
  };

  // Check if all garnitures are "oui"
  const isComplet = useMemo(() => {
    if (!garnitureStep) return false;
    return garnitureStep.options.every((opt) => garniture[opt.id] === "oui");
  }, [garniture, garnitureStep]);

  const toggleSauce = (sauce: string) => {
    setSelectedSauces((prev) =>
      prev.includes(sauce)
        ? prev.filter((s) => s !== sauce)
        : prev.length < 3
          ? [...prev, sauce]
          : prev
    );
  };

  const toggleSupplement = (sup: Supplement) => {
    setSelectedSupplements((prev) =>
      prev.find((s) => s.id === sup.id)
        ? prev.filter((s) => s.id !== sup.id)
        : [...prev, sup]
    );
  };

  const handleAdd = () => {
    // Build garniture choices for cart
    const garnitureChoices = garnitureStep
      ? Object.entries(garniture)
          .filter(([, level]) => level !== "non")
          .map(([optId, level]) => {
            const opt = garnitureStep.options.find((o) => o.id === optId);
            return { name: opt?.name || optId, level: level as "oui" | "x2" };
          })
      : undefined;

    // Build viande choice
    const viandeChoice =
      !skipViande && viandeStep && viandeSelection.length > 0
        ? viandeSelection
            .map((id) => viandeStep.options.find((o) => o.id === id)?.name || id)
            .join(", ")
        : undefined;

    const extraCost = viandeCost + garnitureCost;

    for (let i = 0; i < quantity; i++) {
      addItem(item, selectedSauces, selectedSupplements, restaurantSlug, restaurantId, {
        garnitureChoices,
        viandeChoice,
        extraCost,
      });
    }

    // Reset state
    setViandeSelection([]);
    setGarniture({});
    setSelectedSauces([]);
    setSelectedSupplements([]);
    setQuantity(1);
    onClose();
  };

  const garnitureLevelStyle = (level: GarnitureLevel) => {
    if (level === "oui")
      return {
        backgroundColor: accent,
        color: "#ffffff",
        border: `2px solid ${accent}`,
      };
    if (level === "x2")
      return {
        backgroundColor: accent,
        color: "#ffffff",
        border: `3px solid ${accent}`,
        fontWeight: 700 as const,
      };
    return {
      backgroundColor: "#f3f4f6",
      color: "#9ca3af",
      border: "2px solid transparent",
    };
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="relative w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header: image + name + price + close button */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-xl z-10 border-b border-gray-100">
              {item.image && (
                <div className="w-full h-40 overflow-hidden">
                  <img
                    src={item.image}
                    alt={translated.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {translated.name}
                  </h3>
                  <p className="text-sm font-bold text-gray-700">
                    {item.price.toFixed(2)} €
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Viande section */}
              {viandeStep && !skipViande && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    {viandeStep.title_translations
                      ? Object.values(viandeStep.title_translations)[0] || viandeStep.title
                      : viandeStep.title}
                    {isTacos && (
                      <span className="text-gray-400 font-normal ml-1">
                        (max 3)
                      </span>
                    )}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {viandeStep.options.map((opt, idx) => {
                      const selected = viandeSelection.includes(opt.id);
                      const viandeIndex = viandeSelection.indexOf(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleViande(opt.id)}
                          className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-center"
                          style={
                            selected
                              ? { backgroundColor: accent, color: "#ffffff" }
                              : { backgroundColor: "#f3f4f6", color: "#374151" }
                          }
                        >
                          {selected && <Check className="inline h-3 w-3 mr-1" />}
                          {opt.name}
                          {isTacos && selected && (
                            <span className="ml-1 text-xs opacity-80">
                              {viandeIndex === 0 ? "(1)" : `(${viandeIndex + 1})`}
                            </span>
                          )}
                          {opt.price_modifier > 0 && (
                            <span className="block text-xs opacity-70">
                              +{opt.price_modifier.toFixed(2)} €
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {isTacos && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Viande 1 obligatoire, 2 et 3 optionnelles
                    </p>
                  )}
                </div>
              )}

              {/* Garniture section */}
              {garnitureStep && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {garnitureStep.title_translations
                        ? Object.values(garnitureStep.title_translations)[0] || garnitureStep.title
                        : garnitureStep.title}
                    </h4>
                    <button
                      onClick={handleComplet}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={
                        isComplet
                          ? { backgroundColor: accent, color: "#ffffff" }
                          : { backgroundColor: "#f3f4f6", color: "#374151" }
                      }
                    >
                      {isComplet && <Check className="inline h-3 w-3 mr-0.5" />}
                      Complet
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {garnitureStep.options.map((opt) => {
                      const level = garniture[opt.id] || "non";
                      return (
                        <div
                          key={opt.id}
                          className="flex items-center justify-between py-1.5"
                        >
                          <span
                            className="text-sm"
                            style={{
                              color: level === "non" ? "#9ca3af" : "#111827",
                              fontWeight: level !== "non" ? 500 : 400,
                            }}
                          >
                            {opt.name}
                            {level === "x2" && opt.price_modifier > 0 && (
                              <span className="text-xs ml-1 opacity-60">
                                +{opt.price_modifier.toFixed(2)} €
                              </span>
                            )}
                          </span>
                          <div className="flex gap-1.5">
                            {(["non", "oui", "x2"] as const).map((l) => (
                              <button
                                key={l}
                                onClick={() =>
                                  setGarniture((prev) => ({
                                    ...prev,
                                    [opt.id]: l,
                                  }))
                                }
                                className="min-w-[42px] px-2 py-1 rounded-lg text-xs font-medium transition-all text-center"
                                style={garnitureLevelStyle(
                                  level === l ? l : "non"
                                )}
                              >
                                {l === "non" ? "Non" : l === "oui" ? "Oui" : "x2"}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sauces section */}
              {availableSauces.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    {t("item.sauces")}{" "}
                    <span className="text-gray-400 font-normal">
                      ({t("item.sauces_max", { max: 3 })})
                    </span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {availableSauces.map((sauce) => {
                      const selected = selectedSauces.includes(sauce);
                      return (
                        <button
                          key={sauce}
                          onClick={() => toggleSauce(sauce)}
                          className="px-3 py-1.5 rounded-full text-sm transition-all"
                          style={
                            selected
                              ? { backgroundColor: accent, color: "#ffffff" }
                              : { backgroundColor: "#f3f4f6", color: "#374151" }
                          }
                        >
                          {selected && (
                            <Check className="inline h-3 w-3 mr-1" />
                          )}
                          {sauce}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Supplements section */}
              {item.supplements.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    {t("item.supplements")}
                  </h4>
                  <div className="space-y-2">
                    {item.supplements.map((sup) => {
                      const selected = selectedSupplements.find(
                        (s) => s.id === sup.id
                      );
                      return (
                        <button
                          key={sup.id}
                          onClick={() => toggleSupplement(sup)}
                          className="w-full flex items-center justify-between p-3 rounded-xl transition-all text-left"
                          style={
                            selected
                              ? { backgroundColor: accent, color: "#ffffff" }
                              : { backgroundColor: "#f3f4f6", color: "#374151" }
                          }
                        >
                          <span className="text-sm font-medium">{sup.name}</span>
                          <span className="text-sm">
                            +{sup.price.toFixed(2)} €
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  {t("item.quantity")}
                </span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-semibold w-6 text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Sticky bottom: Add button */}
            <div className="sticky bottom-0 p-4 bg-white border-t border-gray-100">
              <button
                onClick={handleAdd}
                disabled={
                  !skipViande &&
                  viandeStep &&
                  (isTacos ? viandeSelection.length === 0 : viandeSelection.length === 0)
                }
                className="w-full h-14 text-base font-semibold rounded-2xl text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: accent }}
              >
                {t("item.add_to_cart", { price: total.toFixed(2) })}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
