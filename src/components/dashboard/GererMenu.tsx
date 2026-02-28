import { UtensilsCrossed, Palette, QrCode, Settings, BarChart3 } from "lucide-react";

type DashboardView = "cuisine" | "caisse" | "en-direct" | "carte" | "page" | "qrcodes" | "parametres" | "stats" | "gerer";

interface Props {
  onViewChange: (view: DashboardView) => void;
}

const items = [
  { id: "carte" as DashboardView, label: "Ma Carte", desc: "Modifier les plats, prix, categories", icon: UtensilsCrossed },
  { id: "page" as DashboardView, label: "Ma Page", desc: "Logo, couleurs, informations", icon: Palette },
  { id: "qrcodes" as DashboardView, label: "QR Codes", desc: "Generer et telecharger vos QR codes", icon: QrCode },
  { id: "parametres" as DashboardView, label: "Parametres", desc: "Horaires, modes, paiement", icon: Settings },
  { id: "stats" as DashboardView, label: "Statistiques", desc: "Historique, tendances, exports", icon: BarChart3 },
];

export const GererMenu = ({ onViewChange }: Props) => {
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-6">Gerer mon restaurant</h2>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className="bg-card rounded-2xl border border-border p-6 hover:shadow-md cursor-pointer transition-all text-left active:scale-[0.98]"
          >
            <item.icon className="h-8 w-8 text-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
