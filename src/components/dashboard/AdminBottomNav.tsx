import { Flame, Receipt, Eye, Settings } from "lucide-react";
import type { DashboardView } from "@/types/dashboard";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  newOrderCount: number;
}

const adminViews = new Set(["carte", "page", "qrcodes", "borne", "parametres", "stats", "clients"]);

const NAV_ITEMS: { id: DashboardView; labelKey: string; icon: typeof Flame }[] = [
  { id: "cuisine", labelKey: "dashboard.nav.kitchen", icon: Flame },
  { id: "caisse", labelKey: "dashboard.nav.pos", icon: Receipt },
  { id: "en-direct", labelKey: "dashboard.nav.live", icon: Eye },
  { id: "gerer", labelKey: "dashboard.nav.manage", icon: Settings },
];

export const AdminBottomNav = ({ activeView, onViewChange, newOrderCount }: Props) => {
  const { t } = useLanguage();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-background border-t border-border">
      <div className="flex">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeView || (item.id === "gerer" && adminViews.has(activeView));
          return (
            <button
              key={item.id}
              data-tour={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors min-h-[56px] justify-center relative ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.id === "cuisine" && newOrderCount > 0 && (
                  <span className="absolute -top-1.5 -end-2.5 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {newOrderCount}
                  </span>
                )}
              </div>
              <span>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
