import { useState } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import type { DbMenuItem } from "@/types/database";
import { useLanguage } from "@/context/LanguageContext";
import { ItemCustomizeModal } from "./ItemCustomizeModal";

interface Props {
  item: DbMenuItem;
  restaurantSlug: string;
  restaurantId: string;
}

export const MenuItemCard = ({ item, restaurantSlug, restaurantId }: Props) => {
  const [open, setOpen] = useState(false);
  const { t, tMenu } = useLanguage();
  const translated = tMenu(item);

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className="w-full text-left flex gap-3 p-3 rounded-xl hover:bg-secondary/60 transition-colors group"
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground text-[15px] leading-snug">{translated.name}</h4>
            {item.popular && (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-foreground text-primary-foreground px-1.5 py-0.5 rounded-full">
                {t("menu.popular")}
              </span>
            )}
          </div>
          {translated.description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{translated.description}</p>
          )}
          <p className="text-sm font-semibold text-foreground mt-1.5">{item.price.toFixed(2)} €</p>
        </div>

        {item.image && (
          <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
            <img src={item.image} alt={translated.name} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute bottom-1 right-1 bg-foreground text-primary-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus className="h-3.5 w-3.5" />
            </div>
          </div>
        )}

        {!item.image && (
          <div className="flex items-center">
            <div className="bg-secondary rounded-full p-2 group-hover:bg-foreground group-hover:text-primary-foreground transition-colors">
              <Plus className="h-4 w-4" />
            </div>
          </div>
        )}
      </motion.button>

      <ItemCustomizeModal item={item} open={open} onClose={() => setOpen(false)} restaurantSlug={restaurantSlug} restaurantId={restaurantId} />
    </>
  );
};
