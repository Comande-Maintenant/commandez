import { Users, ShoppingCart, ChefHat, TrendingUp } from "lucide-react";
import type { LiveVisitor, VisitorAlert } from "@/types/visitor";
import { getIntensityLabel, WEEKLY_PATTERNS } from "@/lib/demandPatterns";

interface Props {
  visitors: LiveVisitor[];
  alerts: VisitorAlert[];
  orderCounts: { newCount: number; preparingCount: number };
  onNavigate: (tab: string) => void;
  compact?: boolean;
}

export const LiveSummaryBanner = ({ visitors, alerts, orderCounts, onNavigate, compact = false }: Props) => {
  const activeVisitors = visitors.filter((v) => v.activity === "active").length;
  const cartsWithItems = visitors.filter((v) => v.cart_count > 0);
  const totalCartValue = cartsWithItems.reduce((s, v) => s + v.cart_total, 0);
  const hasRush = alerts.some((a) => a.type === "rush");

  const now = new Date();
  const hour = now.getHours();
  const isLunch = hour >= 11 && hour < 14;
  const isDinner = hour >= 18 && hour < 22;
  const pattern = WEEKLY_PATTERNS[now.getDay()];
  const currentIntensity = isLunch ? pattern.midi : isDinner ? pattern.soir : Math.min(pattern.midi, pattern.soir) * 0.3;
  const demandLabel = getIntensityLabel(currentIntensity);

  if (compact) {
    return (
      <div className="bg-card rounded-xl border border-border px-3 py-2 mb-4">
        <div className="flex items-center gap-4 text-xs">
          <span>En ligne: {visitors.length}</span>
          <span>Paniers: {cartsWithItems.length}</span>
          <span>En prep: {orderCounts.preparingCount}</span>
          <span className="font-semibold">{demandLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-3 mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Visitors online */}
        <button
          onClick={() => onNavigate("en-direct")}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors text-left"
        >
          <div className={`p-2 rounded-lg ${hasRush ? "bg-red-100" : "bg-emerald-100"}`}>
            <Users className={`h-4 w-4 ${hasRush ? "text-red-600" : "text-emerald-600"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">En ligne</p>
            <p className="text-lg font-bold text-foreground">
              {visitors.length}
              {activeVisitors < visitors.length && (
                <span className="text-xs font-normal text-muted-foreground ml-1">({activeVisitors} actifs)</span>
              )}
            </p>
          </div>
        </button>

        {/* Active carts */}
        <button
          onClick={() => onNavigate("en-direct")}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors text-left"
        >
          <div className="p-2 rounded-lg bg-amber-100">
            <ShoppingCart className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paniers</p>
            <p className="text-lg font-bold text-foreground">
              {cartsWithItems.length}
              {totalCartValue > 0 && (
                <span className="text-xs font-normal text-muted-foreground ml-1 blur-sensitive">({totalCartValue.toFixed(0)} EUR)</span>
              )}
            </p>
          </div>
        </button>

        {/* Preparing */}
        <button
          onClick={() => onNavigate("cuisine")}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors text-left"
        >
          <div className="p-2 rounded-lg bg-blue-100">
            <ChefHat className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">En preparation</p>
            <p className="text-lg font-bold text-foreground">
              {orderCounts.preparingCount}
              {orderCounts.newCount > 0 && (
                <span className="text-xs font-semibold text-amber-600 ml-1">+{orderCounts.newCount} nouvelle{orderCounts.newCount > 1 ? "s" : ""}</span>
              )}
            </p>
          </div>
        </button>

        {/* Current demand */}
        <button
          onClick={() => onNavigate("en-direct")}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors text-left"
        >
          <div className="p-2 rounded-lg bg-purple-100">
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Demande</p>
            <p className="text-lg font-bold text-foreground">{demandLabel}</p>
          </div>
        </button>
      </div>
    </div>
  );
};
