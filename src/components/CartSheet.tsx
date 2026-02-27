import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export const CartSheet = () => {
  const { items, totalItems, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleOrder = () => {
    setOpen(false);
    navigate("/order");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
                    <h4 className="text-sm font-medium text-foreground">{item.menuItem.name}</h4>
                    {item.selectedSauces.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.selectedSauces.join(", ")}
                      </p>
                    )}
                    {item.selectedSupplements.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + {item.selectedSupplements.map((s) => s.name).join(", ")}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-foreground mt-1">
                      {(item.totalPrice * item.quantity).toFixed(2)} €
                    </p>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button onClick={() => removeItem(item.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 rounded-full bg-background"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 rounded-full bg-background"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
