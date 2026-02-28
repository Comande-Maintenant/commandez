import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Phone, ShoppingBag, ChevronRight, Package, WifiOff, UtensilsCrossed, Plus, Clock } from "lucide-react";
import { fetchOrders, fetchMenuItems, updateOrderStatus, subscribeToOrders } from "@/lib/api";
import type { DbRestaurant, DbMenuItem, DbOrder } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { POSAddItemModal } from "./pos/POSAddItemModal";

type OrderStatus = "new" | "preparing" | "ready" | "done";

const statusConfig: Record<OrderStatus, { label: string; color: string; next?: OrderStatus; nextLabel?: string }> = {
  new: { label: "Nouvelle", color: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]", next: "preparing", nextLabel: "Accepter" },
  preparing: { label: "En preparation", color: "bg-foreground text-primary-foreground", next: "ready", nextLabel: "Prete" },
  ready: { label: "Prete", color: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]", next: "done", nextLabel: "Terminee" },
  done: { label: "Terminee", color: "bg-muted text-muted-foreground" },
};

const filterTabs: { id: OrderStatus | "all"; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "new", label: "Nouvelles" },
  { id: "preparing", label: "En cours" },
  { id: "ready", label: "Pretes" },
  { id: "done", label: "Terminees" },
];

interface Props {
  restaurant: DbRestaurant;
}

export const DashboardOrders = ({ restaurant }: Props) => {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [disconnected, setDisconnected] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [addItemOrder, setAddItemOrder] = useState<DbOrder | null>(null);

  const loadOrders = useCallback(async () => {
    const data = await fetchOrders(restaurant.id);
    setOrders(data);
    setLoading(false);
  }, [restaurant.id]);

  useEffect(() => {
    fetchMenuItems(restaurant.id).then(setMenuItems);
  }, [restaurant.id]);

  useEffect(() => {
    loadOrders();
    const unsub = subscribeToOrders(restaurant.id, (newOrder) => {
      setOrders((prev) => {
        // Update existing or prepend new
        const exists = prev.find((o) => o.id === newOrder.id);
        if (exists) {
          return prev.map((o) => (o.id === newOrder.id ? newOrder : o));
        }
        return [newOrder, ...prev];
      });
      setDisconnected(false);
    });

    // Connection health check - reload orders every 60s to catch missed events
    const healthCheck = setInterval(() => {
      loadOrders().catch(() => setDisconnected(true));
    }, 60000);

    return () => {
      unsub();
      clearInterval(healthCheck);
    };
  }, [restaurant.id, loadOrders]);

  // Auto-cancel stale pending orders for "always open" mode
  useEffect(() => {
    if (restaurant.availability_mode !== "always") return;
    const interval = setInterval(() => {
      const now = Date.now();
      setOrders((prev) =>
        prev.map((o) => {
          if (o.status !== "new") return o;
          const elapsed = now - new Date(o.created_at).getTime();
          if (elapsed > 15 * 60 * 1000) {
            // Auto-cancel after 15 min
            updateOrderStatus(o.id, "done").catch(() => {});
            return { ...o, status: "done" as const };
          }
          return o;
        })
      );
    }, 30000);
    return () => clearInterval(interval);
  }, [restaurant.availability_mode]);

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const newCount = orders.filter((o) => o.status === "new").length;

  const advanceStatus = async (orderId: string, currentStatus: OrderStatus) => {
    const cfg = statusConfig[currentStatus];
    if (!cfg.next) return;
    setAdvancing(orderId);
    try {
      await updateOrderStatus(orderId, cfg.next);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: cfg.next! } : o)));
    } finally {
      setAdvancing(null);
    }
  };

  const timeSince = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "A l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    return `Il y a ${Math.floor(mins / 60)}h`;
  };

  const todayOrders = orders.filter((o) => {
    const d = new Date(o.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Connection lost banner */}
      {disconnected && (
        <div className="mb-4 p-3 bg-destructive/10 rounded-xl flex items-center gap-2 text-sm text-destructive">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          Connexion perdue. Reconnexion en cours...
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Nouvelles", value: orders.filter((o) => o.status === "new").length, accent: true },
          { label: "En cours", value: orders.filter((o) => o.status === "preparing").length },
          { label: "Pretes", value: orders.filter((o) => o.status === "ready").length },
          { label: "CA du jour", value: `${todayOrders.reduce((s, o) => s + Number(o.total), 0).toFixed(2)} €`, sensitive: true },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-2xl border border-border p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 ${stat.accent ? "text-[hsl(var(--warning))]" : "text-foreground"} ${stat.sensitive ? "blur-sensitive" : ""}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[44px] ${filter === tab.id ? "bg-foreground text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
            {tab.id === "new" && newCount > 0 && (
              <span className="ml-1.5 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] text-xs font-bold px-1.5 py-0.5 rounded-full">{newCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {filter === "all" ? "Pas encore de commande aujourd'hui. Ca va venir !" : "Aucune commande"}
            </p>
          </div>
        )}
        {filtered.map((order) => {
          const cfg = statusConfig[order.status as OrderStatus];
          const orderItems = (order.items as any[]) || [];
          return (
            <motion.div key={order.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-lg font-bold text-foreground">#{order.order_number}</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  {(order as any).source === "pos" && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">Caisse</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{timeSince(order.created_at)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                <span className="font-medium text-foreground">{order.customer_name}</span>
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{order.customer_phone}</span>
                <span className="flex items-center gap-1">
                  {(order.order_type === "collect" || order.order_type === "a_emporter") && <><ShoppingBag className="h-3.5 w-3.5" /> A emporter</>}
                  {order.order_type === "sur_place" && <><UtensilsCrossed className="h-3.5 w-3.5" /> Sur place</>}
                  {order.order_type === "telephone" && <><Phone className="h-3.5 w-3.5" /> Telephone</>}
                </span>
                {(order as any).covers && (
                  <span className="text-xs text-muted-foreground">({(order as any).covers} couvert{(order as any).covers > 1 ? "s" : ""})</span>
                )}
                {order.pickup_time ? (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    <Clock className="h-3 w-3" />
                    Retrait a {new Date(order.pickup_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : (order.order_type === "collect" || order.order_type === "a_emporter") ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">ASAP</span>
                ) : null}
              </div>
              <div className="space-y-1 mb-3">
                {orderItems.map((item: any, i: number) => (
                  <div key={i} className="flex items-start justify-between text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground font-medium">{item.quantity}x {item.name}</span>
                      {item.summary && (
                        <p className="text-xs text-muted-foreground truncate">{item.summary}</p>
                      )}
                      {!item.summary && ((item.sauces?.length > 0) || (item.supplements?.length > 0)) && (
                        <p className="text-xs text-muted-foreground truncate">{[...(item.sauces || []), ...(item.supplements || [])].join(", ")}</p>
                      )}
                    </div>
                    <span className="text-foreground font-medium ml-2 flex-shrink-0 blur-sensitive">{(item.price * item.quantity).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-base font-bold text-foreground blur-sensitive">{Number(order.total).toFixed(2)} €</span>
                <div className="flex items-center gap-2">
                  {(order.status === "new" || order.status === "preparing") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAddItemOrder(order)}
                      className="rounded-xl gap-1 min-h-[36px] text-xs text-muted-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" /> Ajouter
                    </Button>
                  )}
                  {cfg.next && (
                    <Button
                      size="sm"
                      onClick={() => advanceStatus(order.id, order.status as OrderStatus)}
                      disabled={advancing === order.id}
                      className="rounded-xl gap-1 min-h-[44px]"
                    >
                      {advancing === order.id ? "..." : cfg.nextLabel}<ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add item modal */}
      {addItemOrder && (
        <POSAddItemModal
          open={!!addItemOrder}
          onClose={() => setAddItemOrder(null)}
          order={addItemOrder}
          menuItems={menuItems}
          config={restaurant.customization_config}
          onUpdated={loadOrders}
        />
      )}
    </div>
  );
};
