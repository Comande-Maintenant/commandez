import { useState } from "react";
import { Flame, Receipt, Eye, UtensilsCrossed, Palette, QrCode, Tablet, Settings, BarChart3, ChevronDown, Users } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { DashboardView } from "@/types/dashboard";

interface Props {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  newOrderCount: number;
}

const opsItemsDef: { id: DashboardView; tKey: string; icon: typeof Flame }[] = [
  { id: "cuisine", tKey: "dashboard.nav.kitchen", icon: Flame },
  { id: "caisse", tKey: "dashboard.nav.pos", icon: Receipt },
  { id: "en-direct", tKey: "dashboard.nav.live", icon: Eye },
];

const adminItemsDef: { id: DashboardView; tKey: string; icon: typeof Flame }[] = [
  { id: "carte", tKey: "dashboard.nav.menu", icon: UtensilsCrossed },
  { id: "page", tKey: "dashboard.nav.page", icon: Palette },
  { id: "qrcodes", tKey: "dashboard.nav.qrcodes", icon: QrCode },
  { id: "tablettes", tKey: "dashboard.nav.tablets", icon: Tablet },
  { id: "clients", tKey: "dashboard.nav.clients", icon: Users },
  { id: "parametres", tKey: "dashboard.nav.settings", icon: Settings },
  { id: "stats", tKey: "dashboard.nav.stats", icon: BarChart3 },
];

const isAdminView = (v: DashboardView) => ["carte", "page", "qrcodes", "tablettes", "parametres", "stats", "clients"].includes(v);

export const AdminSidebar = ({ activeView, onViewChange, newOrderCount }: Props) => {
  const { t } = useLanguage();
  const [gererExpanded, setGererExpanded] = useState(() => isAdminView(activeView));

  const handleViewChange = (view: DashboardView) => {
    onViewChange(view);
    if (isAdminView(view)) setGererExpanded(true);
  };

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 w-60 h-screen border-r border-border bg-background z-40">
      <div className="p-4 flex-1 flex flex-col gap-1">
        {/* Operational views */}
        {opsItemsDef.map((item) => (
          <button
            key={item.id}
            data-tour={item.id}
            onClick={() => handleViewChange(item.id)}
            className={`flex items-center gap-3 px-3 min-h-[48px] rounded-xl transition-colors ${
              activeView === item.id
                ? "bg-foreground text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-medium">{t(item.tKey)}</span>
            {item.id === "cuisine" && newOrderCount > 0 && (
              <span className="ml-auto bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {newOrderCount}
              </span>
            )}
          </button>
        ))}

        {/* Separator */}
        <div className="border-t border-border my-3" />

        {/* Gerer section */}
        <button
          data-tour="gerer"
          onClick={() => setGererExpanded(!gererExpanded)}
          className="flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-muted-foreground hover:bg-secondary transition-colors"
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{t('dashboard.nav.manage')}</span>
          <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${gererExpanded ? "rotate-180" : ""}`} />
        </button>

        {gererExpanded && (
          <div className="flex flex-col gap-1 pl-2">
            {adminItemsDef.map((item) => (
              <button
                key={item.id}
                onClick={() => handleViewChange(item.id)}
                className={`flex items-center gap-3 px-3 min-h-[44px] rounded-xl transition-colors ${
                  activeView === item.id
                    ? "bg-foreground text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium">{t(item.tKey)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
