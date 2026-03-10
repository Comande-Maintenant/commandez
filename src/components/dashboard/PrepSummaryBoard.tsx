import { ChefHat, Clock } from "lucide-react";
import type { DbOrder } from "@/types/database";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  orders: DbOrder[];
  nextOpeningMessage?: string | null;
}

interface PrepLine {
  label: string;
  qty: number;
  isUrgent: boolean; // new orders (not yet accepted)
}

function buildPrepLines(orders: DbOrder[]): PrepLine[] {
  const activeOrders = orders.filter(
    (o) => o.status === "new" || o.status === "preparing"
  );
  if (activeOrders.length === 0) return [];

  // Group items across orders
  const groups: Record<string, { qty: number; isUrgent: boolean }> = {};

  for (const order of activeOrders) {
    const items = (order.items as any[]) || [];
    const urgent = order.status === "new";

    for (const item of items) {
      const name = item.name || "?";
      const quantity = item.quantity || 1;
      // Simplify the label for kitchen readability
      const key = name.trim().toLowerCase();

      if (!groups[key]) {
        groups[key] = { qty: 0, isUrgent: false };
      }
      groups[key].qty += quantity;
      if (urgent) groups[key].isUrgent = true;
    }
  }

  return Object.entries(groups)
    .map(([key, val]) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      qty: val.qty,
      isUrgent: val.isUrgent,
    }))
    .sort((a, b) => {
      // Urgent first, then by quantity desc
      if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
      return b.qty - a.qty;
    });
}

export const PrepSummaryBoard = ({ orders, nextOpeningMessage }: Props) => {
  const { t } = useLanguage();
  const lines = buildPrepLines(orders);
  const activeCount = orders.filter(
    (o) => o.status === "new" || o.status === "preparing"
  ).length;

  if (lines.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 mb-4 text-center">
        <p className="text-sm text-muted-foreground">{t("dashboard.prep.nothing")}</p>
        {nextOpeningMessage && (
          <p className="text-xs mt-1.5 text-muted-foreground/70">
            <Clock className="h-3 w-3 inline -mt-0.5 mr-1" />
            {nextOpeningMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <ChefHat className="h-5 w-5 text-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          {t("dashboard.prep.title", { count: activeCount })}
        </h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {lines.map((line) => (
          <div
            key={line.label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              line.isUrgent
                ? "bg-amber-100 text-amber-800 border border-amber-200"
                : "bg-secondary text-foreground border border-border"
            }`}
          >
            {line.isUrgent && <Clock className="h-3 w-3" />}
            <span className="font-bold">{line.qty}x</span>
            <span>{line.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
