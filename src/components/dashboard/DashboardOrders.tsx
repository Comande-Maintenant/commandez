import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, MapPin, ShoppingBag, ChevronRight, Package } from "lucide-react";
import { mockOrders, type Order, type OrderStatus } from "@/data/mockOrders";
import { Button } from "@/components/ui/button";

const statusConfig: Record<OrderStatus, { label: string; color: string; next?: OrderStatus; nextLabel?: string }> = {
  new: { label: "Nouvelle", color: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]", next: "preparing", nextLabel: "Accepter" },
  preparing: { label: "En préparation", color: "bg-foreground text-primary-foreground", next: "ready", nextLabel: "Prête" },
  ready: { label: "Prête", color: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]", next: "done", nextLabel: "Terminée" },
  done: { label: "Terminée", color: "bg-muted text-muted-foreground" },
};

const filterTabs: { id: OrderStatus | "all"; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "new", label: "Nouvelles" },
  { id: "preparing", label: "En cours" },
  { id: "ready", label: "Prêtes" },
  { id: "done", label: "Terminées" },
];

export const DashboardOrders = () => {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const newCount = orders.filter((o) => o.status === "new").length;

  const advanceStatus = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const cfg = statusConfig[o.status];
        return cfg.next ? { ...o, status: cfg.next } : o;
      })
    );
  };

  const timeSince = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    return `Il y a ${Math.floor(mins / 60)}h`;
  };

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Nouvelles", value: orders.filter((o) => o.status === "new").length, accent: true },
          { label: "En cours", value: orders.filter((o) => o.status === "preparing").length },
          { label: "Prêtes", value: orders.filter((o) => o.status === "ready").length },
          { label: "CA du jour", value: `${orders.reduce((s, o) => s + o.total, 0).toFixed(2)} €` },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.accent ? "text-[hsl(var(--warning))]" : "text-foreground"}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filter === tab.id
                ? "bg-foreground text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.id === "new" && newCount > 0 && (
              <span className="ml-1.5 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] text-xs font-bold px-1.5 py-0.5 rounded-full">
                {newCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Order Cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucune commande</p>
          </div>
        )}
        {filtered.map((order) => {
          const cfg = statusConfig[order.status];
          return (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-foreground">#{order.number}</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{timeSince(order.createdAt)}</span>
              </div>

              {/* Customer */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span className="font-medium text-foreground">{order.customerName}</span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {order.customerPhone}
                </span>
                <span className="flex items-center gap-1">
                  {order.type === "collect" ? (
                    <><ShoppingBag className="h-3.5 w-3.5" /> Click & Collect</>
                  ) : (
                    <><MapPin className="h-3.5 w-3.5" /> Livraison</>
                  )}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-1 mb-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between text-sm">
                    <div>
                      <span className="text-foreground font-medium">{item.quantity}× {item.name}</span>
                      {(item.sauces.length > 0 || item.supplements.length > 0) && (
                        <p className="text-xs text-muted-foreground">
                          {[...item.sauces, ...item.supplements].join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="text-foreground font-medium">{(item.price * item.quantity).toFixed(2)} €</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-base font-bold text-foreground">{order.total.toFixed(2)} €</span>
                {cfg.next && (
                  <Button
                    size="sm"
                    onClick={() => advanceStatus(order.id)}
                    className="rounded-xl gap-1"
                  >
                    {cfg.nextLabel}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
