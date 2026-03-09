import { useState, useEffect } from "react";
import { Clock, ShoppingBag, UtensilsCrossed, Phone, Package, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchOrders, fetchDemoOrders, fetchCustomers, fetchDemoCustomers } from "@/lib/api";
import { formatDisplayNumber } from "@/lib/orderNumber";
import { useLanguage } from "@/context/LanguageContext";
import type { DbOrder, DbCustomer } from "@/types/database";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerBadge } from "./CustomerBadge";

interface Props {
  restaurantId: string;
  isDemo?: boolean;
  open: boolean;
  onClose: () => void;
}

type OrderStatus = "new" | "preparing" | "ready" | "done";

const statusConfig: Record<string, { icon: string; class: string }> = {
  done: { icon: "done", class: "bg-emerald-100 text-emerald-700" },
  ready: { icon: "ready", class: "bg-blue-100 text-blue-700" },
  preparing: { icon: "preparing", class: "bg-blue-100 text-blue-700" },
  new: { icon: "new", class: "bg-amber-100 text-amber-700" },
};

export const OrderHistorySheet = ({ restaurantId, isDemo, open, onClose }: Props) => {
  const { t, language } = useLanguage();

  const LOCALE_MAP: Record<string, string> = { fr: "fr-FR", en: "en-US", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-PT", nl: "nl-NL", ar: "ar-SA", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", ru: "ru-RU", tr: "tr-TR", vi: "vi-VN" };
  const locale = LOCALE_MAP[language] || "fr-FR";

  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [customersMap, setCustomersMap] = useState<Map<string, DbCustomer>>(new Map());

  // Only fetch when opened (lazy load)
  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);

    const fetchFn = isDemo ? fetchDemoOrders(restaurantId) : fetchOrders(restaurantId);
    fetchFn.then((data) => {
      // Filter last 24h
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const recent = data
        .filter((o: DbOrder) => new Date(o.created_at).getTime() > cutoff)
        .sort((a: DbOrder, b: DbOrder) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setOrders(recent);
      setLoading(false);
      setLoaded(true);
    }).catch(() => {
      setLoading(false);
    });

    // Load customers for badges
    const custFn = isDemo ? fetchDemoCustomers(restaurantId) : fetchCustomers(restaurantId);
    custFn.then((custs) => {
      const map = new Map<string, DbCustomer>();
      custs.forEach((c: DbCustomer) => map.set(c.customer_phone, c));
      setCustomersMap(map);
    }).catch(() => {});
  }, [open, loaded, restaurantId, isDemo]);

  // Reset cache when closed to allow refresh on next open
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => setLoaded(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  };

  const orderTypeIcon = (type: string) => {
    if (type === "collect" || type === "a_emporter") return <ShoppingBag className="h-3 w-3" />;
    if (type === "sur_place") return <UtensilsCrossed className="h-3 w-3" />;
    if (type === "telephone") return <Phone className="h-3 w-3" />;
    return null;
  };

  const orderTypeLabel = (type: string) => {
    if (type === "collect" || type === "a_emporter") return t("dashboard.orders.takeaway");
    if (type === "sur_place") return t("dashboard.orders.dine_in");
    if (type === "telephone") return t("dashboard.orders.phone");
    return "";
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("dashboard.history.title")}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          )}

          {!loading && orders.length === 0 && (
            <div className="text-center py-16">
              <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">{t("dashboard.history.empty")}</p>
            </div>
          )}

          {!loading && orders.map((order) => {
            const st = order.status as OrderStatus;
            const cfg = statusConfig[st] || statusConfig.done;
            const items = (order.items as any[]) || [];
            const itemSummary = items
              .map((i: any) => `${i.quantity > 1 ? i.quantity + "x " : ""}${i.name}`)
              .join(", ");

            return (
              <div
                key={order.id}
                className="rounded-xl border border-border p-3 bg-card hover:bg-secondary/30 transition-colors"
              >
                {/* Top: number + status + time */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{formatDisplayNumber(order)}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.class}`}>
                      {t(`dashboard.orders.status_${st}`)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTime(order.created_at)}</span>
                </div>

                {/* Order type */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  {orderTypeIcon(order.order_type)}
                  <span>{orderTypeLabel(order.order_type)}</span>
                  {order.customer_name && (
                    <>
                      <span>-</span>
                      <span className="font-medium text-foreground">
                        {order.customer_name}
                        <CustomerBadge customer={customersMap.get(order.customer_phone) ?? null} compact />
                      </span>
                    </>
                  )}
                </div>

                {/* Items summary */}
                <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{itemSummary}</p>

                {/* Total */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground blur-sensitive">{Number(order.total).toFixed(2)} EUR</span>
                  <span className="text-[10px] text-muted-foreground">{items.reduce((s: number, i: any) => s + (i.quantity || 1), 0)} {t("dashboard.history.items_short")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
