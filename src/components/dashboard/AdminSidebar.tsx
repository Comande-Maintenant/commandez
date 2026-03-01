import { useState } from "react";
import { Flame, Receipt, Eye, UtensilsCrossed, Palette, QrCode, Tablet, Settings, BarChart3, ChevronDown, Users } from "lucide-react";
import type { DashboardView } from "@/types/dashboard";

interface Props {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  newOrderCount: number;
}

const opsItems: { id: DashboardView; label: string; icon: typeof Flame }[] = [
  { id: "cuisine", label: "Cuisine", icon: Flame },
  { id: "caisse", label: "Caisse", icon: Receipt },
  { id: "en-direct", label: "En direct", icon: Eye },
];

const adminItems: { id: DashboardView; label: string; icon: typeof Flame }[] = [
  { id: "carte", label: "Ma Carte", icon: UtensilsCrossed },
  { id: "page", label: "Ma Page", icon: Palette },
  { id: "qrcodes", label: "QR Codes", icon: QrCode },
  { id: "tablettes", label: "Mes tablettes", icon: Tablet },
  { id: "clients", label: "Mes clients", icon: Users },
  { id: "parametres", label: "Parametres", icon: Settings },
  { id: "stats", label: "Statistiques", icon: BarChart3 },
];

const isAdminView = (v: DashboardView) => ["carte", "page", "qrcodes", "tablettes", "parametres", "stats", "clients"].includes(v);

export const AdminSidebar = ({ activeView, onViewChange, newOrderCount }: Props) => {
  const [gererExpanded, setGererExpanded] = useState(() => isAdminView(activeView));

  const handleViewChange = (view: DashboardView) => {
    onViewChange(view);
    if (isAdminView(view)) setGererExpanded(true);
  };

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 w-60 h-screen border-r border-border bg-background z-40">
      <div className="p-4 flex-1 flex flex-col gap-1">
        {/* Operational views */}
        {opsItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleViewChange(item.id)}
            className={`flex items-center gap-3 px-3 min-h-[48px] rounded-xl transition-colors ${
              activeView === item.id
                ? "bg-foreground text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-medium">{item.label}</span>
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
          onClick={() => setGererExpanded(!gererExpanded)}
          className="flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-muted-foreground hover:bg-secondary transition-colors"
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-semibold">Gerer</span>
          <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${gererExpanded ? "rotate-180" : ""}`} />
        </button>

        {gererExpanded && (
          <div className="flex flex-col gap-1 pl-2">
            {adminItems.map((item) => (
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
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
