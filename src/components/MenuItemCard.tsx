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
  primaryColor?: string;
  primaryLight?: string;
  isEven?: boolean;
}

export const MenuItemCard = ({ item, restaurantSlug, restaurantId, primaryColor, primaryLight, isEven }: Props) => {
  const [open, setOpen] = useState(false);
  const { t, tMenu } = useLanguage();
  const translated = tMenu(item);

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className="w-full text-left flex gap-3 p-3 rounded-xl transition-all group hover:shadow-md active:scale-[0.98]"
        style={{ backgroundColor: isEven ? "transparent" : `${primaryLight || "#f5f5f5"}40` }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900 text-[15px] leading-snug">{translated.name}</h4>
            {item.popular && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider text-white px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: primaryColor || "#FF6B00" }}
              >
                {t("menu.popular")}
              </span>
            )}
          </div>
          {translated.description && (
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{translated.description}</p>
          )}
          {item.price > 0 && (
            <p className="text-sm font-bold text-gray-900 mt-1.5">{item.price.toFixed(2)} €</p>
          )}
        </div>

        {item.image ? (
          <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
            <img src={item.image} alt={translated.name} className="w-full h-full object-cover" loading="lazy" />
            <div
              className="absolute bottom-1 right-1 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity text-white"
              style={{ backgroundColor: primaryColor || "#FF6B00" }}
            >
              <Plus className="h-3.5 w-3.5" />
            </div>
          </div>
        ) : (
          <div className="flex items-center">
            <div
              className="rounded-full p-2 transition-colors text-white"
              style={{ backgroundColor: primaryColor || "#FF6B00" }}
            >
              <Plus className="h-4 w-4" />
            </div>
          </div>
        )}
      </motion.button>

      <ItemCustomizeModal
        item={item}
        open={open}
        onClose={() => setOpen(false)}
        restaurantSlug={restaurantSlug}
        restaurantId={restaurantId}
        primaryColor={primaryColor}
      />
    </>
  );
};
