import { Flame, Receipt, Eye, Settings } from "lucide-react";
import type { DashboardView } from "@/types/dashboard";

interface Props {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  newOrderCount: number;
}

const adminViews = new Set(["carte", "page", "qrcodes", "tablettes", "parametres", "stats", "clients"]);

const items: { id: DashboardView; label: string; icon: typeof Flame }[] = [
  { id: "cuisine", label: "Cuisine", icon: Flame },
  { id: "caisse", label: "Caisse", icon: Receipt },
  { id: "en-direct", label: "En direct", icon: Eye },
  { id: "gerer", label: "Gerer", icon: Settings },
];

export const AdminBottomNav = ({ activeView, onViewChange, newOrderCount }: Props) => {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="flex">
        {items.map((item) => {
          const isActive = item.id === activeView || (item.id === "gerer" && adminViews.has(activeView));
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors min-h-[56px] justify-center relative ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.id === "cuisine" && newOrderCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {newOrderCount}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
