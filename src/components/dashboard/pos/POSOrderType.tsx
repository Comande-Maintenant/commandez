import { UtensilsCrossed, ShoppingBag, Phone } from "lucide-react";
import { motion } from "framer-motion";
import type { POSOrderType as POSOrderTypeValue } from "@/types/pos";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  onSelect: (type: POSOrderTypeValue) => void;
}

const optionsDef: { type: POSOrderTypeValue; labelKey: string; icon: typeof UtensilsCrossed }[] = [
  { type: "sur_place", labelKey: "pos.dine_in", icon: UtensilsCrossed },
  { type: "a_emporter", labelKey: "pos.takeaway", icon: ShoppingBag },
  { type: "telephone", labelKey: "pos.phone", icon: Phone },
];

export const POSOrderType = ({ onSelect }: Props) => {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-4"
    >
      <h2 className="text-2xl font-bold text-foreground mb-8">{t('pos.order_type')}</h2>

      <div className="grid gap-4 w-full max-w-md">
        {optionsDef.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            className="flex items-center gap-4 bg-card border border-border rounded-2xl p-6 min-h-[80px] hover:shadow-md hover:border-foreground/20 transition-all active:scale-[0.98]"
          >
            <opt.icon className="h-8 w-8 text-foreground flex-shrink-0" />
            <span className="text-xl font-semibold text-foreground">{t(opt.labelKey)}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};
