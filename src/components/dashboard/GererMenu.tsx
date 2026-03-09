import { UtensilsCrossed, Palette, QrCode, Monitor, Settings, BarChart3, Users, ChefHat } from "lucide-react";
import type { DashboardView } from "@/types/dashboard";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  onViewChange: (view: DashboardView) => void;
}

const itemDefs = [
  { id: "carte" as DashboardView, labelKey: "dashboard.manage.menu_label", descKey: "dashboard.manage.menu_desc", icon: UtensilsCrossed },
  { id: "customization" as DashboardView, labelKey: "dashboard.manage.customization_label", descKey: "dashboard.manage.customization_desc", icon: ChefHat },
  { id: "page" as DashboardView, labelKey: "dashboard.manage.page_label", descKey: "dashboard.manage.page_desc", icon: Palette },
  { id: "qrcodes" as DashboardView, labelKey: "dashboard.manage.qr_label", descKey: "dashboard.manage.qr_desc", icon: QrCode },
  { id: "borne" as DashboardView, labelKey: "dashboard.manage.kiosk_label", descKey: "dashboard.manage.kiosk_desc", icon: Monitor },
  { id: "clients" as DashboardView, labelKey: "dashboard.manage.clients_label", descKey: "dashboard.manage.clients_desc", icon: Users },
  { id: "parametres" as DashboardView, labelKey: "dashboard.manage.settings_label", descKey: "dashboard.manage.settings_desc", icon: Settings },
  { id: "stats" as DashboardView, labelKey: "dashboard.manage.stats_label", descKey: "dashboard.manage.stats_desc", icon: BarChart3 },
];

export const GererMenu = ({ onViewChange }: Props) => {
  const { t } = useLanguage();

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-6">{t('dashboard.manage.title')}</h2>
      <div className="grid grid-cols-2 gap-4">
        {itemDefs.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className="bg-card rounded-2xl border border-border p-6 hover:shadow-md cursor-pointer transition-all text-start active:scale-[0.98]"
          >
            <item.icon className="h-8 w-8 text-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">{t(item.labelKey)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t(item.descKey)}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
