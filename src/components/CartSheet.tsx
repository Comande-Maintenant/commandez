import { Minus, Plus, Trash2, ShoppingBag, UtensilsCrossed, GlassWater } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { motion, AnimatePresence } from "framer-motion";
import type { DbMenuItem } from "@/types/database";

interface CartSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  menuItems?: DbMenuItem[];
  onScrollToCategory?: (category: string) => void;
}

export const CartSheet = ({ open, onOpenChange, menuItems, onScrollToCategory }: CartSheetProps) => {
  const { items, totalItems, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();
  const { t, tMenu, tText } = useLanguage();

  const handleOrder = () => {
    onOpenChange?.(false);
    navigate("/order");
  };

  const handleGoToCategory = (category: string) => {
    onOpenChange?.(false);
    onScrollToCategory?.(category);
  };

  // Detect if desserts or boissons exist in the menu
  const hasDesserts = menuItems?.some((m) => m.category?.toLowerCase().includes("dessert") && m.enabled) ?? false;
  const hasBoissons = menuItems?.some((m) =>
    (m.category?.toLowerCase().includes("boisson") || m.category?.toLowerCase().includes("drink")) && m.enabled
  ) ?? false;

  // Find the exact category names for navigation
  const dessertCategory = menuItems?.find((m) => m.category?.toLowerCase().includes("dessert") && m.enabled)?.category;
  const boissonCategory = menuItems?.find((m) =>
    (m.category?.toLowerCase().includes("boisson") || m.category?.toLowerCase().includes("drink")) && m.enabled
  )?.category;

  const showUpsell = items.length > 0 && (hasDesserts || hasBoissons) && onScrollToCategory;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Only render trigger when used standalone (not controlled) */}
      {open === undefined && (
        <SheetTrigger asChild>
          <button className="relative p-2">
            <ShoppingBag className="h-6 w-6 text-foreground" />
            <AnimatePresence>
              {totalItems > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 bg-foreground text-primary-foreground text-[11px] font-bold rounded-full h-5 w-5 flex items-center justify-center"
                >
                  {totalItems}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </SheetTrigger>
      )}
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="text-lg font-semibold">
            {t("cart.your_cart")} {totalItems > 0 && `(${totalItems})`}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">{t("cart.empty")}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 bg-secondary/50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground">{tMenu(item.menuItem).name}</h4>
                    {item.viandeChoice && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("cart.meat_label").replace("{value}", tText(item.viandeChoice))}
                      </p>
                    )}
                    {item.garnitureChoices && item.garnitureChoices.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("cart.topping_label").replace("{value}", item.garnitureChoices.map((g) => g.level === "x2" ? `${tText(g.name)} x2` : tText(g.name)).join(", "))}
                      </p>
                    )}
                    {item.baseChoice && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("cart.base_label").replace("{value}", tText(item.baseChoice))}
                      </p>
                    )}
                    {item.selectedSauces.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("cart.sauces_label").replace("{value}", item.selectedSauces.map((s) => tText(s)).join(", "))}
                      </p>
                    )}
                    {item.accompagnementChoice && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        + {tText(item.accompagnementChoice.name)}
                        {item.accompagnementChoice.size ? ` (${tText(item.accompagnementChoice.size)})` : ""}
                        {item.accompagnementChoice.sauces?.length ? ` - ${item.accompagnementChoice.sauces.map((s) => tText(s)).join(", ")}` : ""}
                      </p>
                    )}
                    {item.drinkChoice && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        + {tText(item.drinkChoice.name)}
                      </p>
                    )}
                    {item.dessertChoice && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        + {tText(item.dessertChoice.name)}
                      </p>
                    )}
                    {/* Generic custom choices (non-kebab cuisines) */}
                    {item.customChoices && item.customChoices.length > 0 && !item.baseChoice && !item.viandeChoice && (
                      <>
                        {item.customChoices.filter((c) => c.selections.length > 0).map((choice) => (
                          <p key={choice.stepKey} className="text-xs text-muted-foreground mt-0.5">
                            {tText(choice.stepLabel)} : {choice.selections.map((s) => tText(s.name)).join(", ")}
                          </p>
                        ))}
                      </>
                    )}
                    {item.selectedSupplements.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + {item.selectedSupplements.map((s) => tText(s.name)).join(", ")}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-foreground mt-1">
                      {(item.totalPrice * item.quantity).toFixed(2)} €
                    </p>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button onClick={() => removeItem(item.id)} className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" aria-label={t("cart.remove")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full bg-background"
                        aria-label={t("cart.decrease")}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full bg-background"
                        aria-label={t("cart.increase")}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Upsell section */}
              {showUpsell && (
                <div className="mt-2 pt-3 border-t border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {t("cart.upsell_title")}
                  </p>
                  <div className="flex gap-2">
                    {hasDesserts && dessertCategory && (
                      <button
                        onClick={() => handleGoToCategory(dessertCategory)}
                        className="flex-1 flex items-center gap-2 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors text-left"
                      >
                        <UtensilsCrossed className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <span className="text-xs font-medium text-amber-800">{t("cart.upsell_dessert")}</span>
                      </button>
                    )}
                    {hasBoissons && boissonCategory && (
                      <button
                        onClick={() => handleGoToCategory(boissonCategory)}
                        className="flex-1 flex items-center gap-2 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                      >
                        <GlassWater className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <span className="text-xs font-medium text-blue-800">{t("cart.upsell_boisson")}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                <span className="font-semibold text-foreground">{subtotal.toFixed(2)} €</span>
              </div>
              <Button onClick={handleOrder} className="w-full h-14 text-base font-semibold rounded-2xl" size="lg">
                {t("cart.order")} - {subtotal.toFixed(2)} €
              </Button>
              <button onClick={clearCart} className="w-full text-center text-sm text-muted-foreground hover:text-destructive transition-colors">
                {t("cart.clear")}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
