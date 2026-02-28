import { UtensilsCrossed, ShoppingBag, Phone, X } from "lucide-react";
import { motion } from "framer-motion";
import type { POSOrderType as POSOrderTypeValue } from "@/types/pos";

interface Props {
  onSelect: (type: POSOrderTypeValue) => void;
  onClose: () => void;
}

const options: { type: POSOrderTypeValue; label: string; icon: typeof UtensilsCrossed }[] = [
  { type: "sur_place", label: "Sur place", icon: UtensilsCrossed },
  { type: "a_emporter", label: "A emporter", icon: ShoppingBag },
  { type: "telephone", label: "Telephone", icon: Phone },
];

export const POSOrderType = ({ onSelect, onClose }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-4"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-full hover:bg-secondary transition-colors"
      >
        <X className="h-6 w-6 text-foreground" />
      </button>

      <h2 className="text-2xl font-bold text-foreground mb-8">Type de commande</h2>

      <div className="grid gap-4 w-full max-w-md">
        {options.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            className="flex items-center gap-4 bg-card border border-border rounded-2xl p-6 min-h-[80px] hover:shadow-md hover:border-foreground/20 transition-all active:scale-[0.98]"
          >
            <opt.icon className="h-8 w-8 text-foreground flex-shrink-0" />
            <span className="text-xl font-semibold text-foreground">{opt.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};
