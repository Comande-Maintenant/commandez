import { useState, useMemo } from "react";
import { X, Minus, Plus, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DbMenuItem, Supplement } from "@/types/database";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  item: DbMenuItem;
  open: boolean;
  onClose: () => void;
  restaurantSlug: string;
  restaurantId: string;
  primaryColor?: string;
}

export const ItemCustomizeModal = ({ item, open, onClose, restaurantSlug, restaurantId, primaryColor }: Props) => {
  const { addItem } = useCart();
  const { t, tMenu } = useLanguage();
  const [selectedSauces, setSelectedSauces] = useState<string[]>([]);
  const [selectedSupplements, setSelectedSupplements] = useState<Supplement[]>([]);
  const [quantity, setQuantity] = useState(1);

  const accent = primaryColor || "#10B981";
  const translated = tMenu(item);

  const toggleSauce = (sauce: string) => {
    setSelectedSauces((prev) =>
      prev.includes(sauce) ? prev.filter((s) => s !== sauce) : prev.length < 3 ? [...prev, sauce] : prev
    );
  };

  const toggleSupplement = (sup: Supplement) => {
    setSelectedSupplements((prev) =>
      prev.find((s) => s.id === sup.id) ? prev.filter((s) => s.id !== sup.id) : [...prev, sup]
    );
  };

  const unitPrice = useMemo(() => {
    return item.price + selectedSupplements.reduce((sum, s) => sum + s.price, 0);
  }, [item.price, selectedSupplements]);

  const total = unitPrice * quantity;

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      addItem(item, selectedSauces, selectedSupplements, restaurantSlug, restaurantId);
    }
    setSelectedSauces([]);
    setSelectedSupplements([]);
    setQuantity(1);
    onClose();
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-md max-h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl overflow-y-auto"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="sticky top-0 bg-white/90 backdrop-blur-xl z-10 p-4 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">{translated.name}</h3>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Fermer">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {item.image && (
                <div className="w-full h-48 rounded-2xl overflow-hidden">
                  <img src={item.image} alt={translated.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}

              {translated.description && <p className="text-gray-500 text-sm">{translated.description}</p>}

              {item.sauces.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    {t("item.sauces")} <span className="text-gray-400 font-normal">({t("item.sauces_max", { max: 3 })})</span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {item.sauces.map((sauce) => {
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
                          {selected && <Check className="inline h-3 w-3 mr-1" />}
                          {sauce}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {item.supplements.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">{t("item.supplements")}</h4>
                  <div className="space-y-2">
                    {item.supplements.map((sup) => {
                      const selected = selectedSupplements.find((s) => s.id === sup.id);
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
                          <span className="text-sm">+{sup.price.toFixed(2)} €</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{t("item.quantity")}</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-semibold w-6 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 p-4 bg-white border-t border-gray-100">
              <button
                onClick={handleAdd}
                className="w-full h-14 text-base font-semibold rounded-2xl text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
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
