import { motion } from "framer-motion";
import { Smartphone, Monitor, QrCode, Link2, Eye, ShoppingCart, Users, AlertTriangle } from "lucide-react";
import type { LiveVisitor, VisitorAlert } from "@/types/visitor";

interface Props {
  visitors: LiveVisitor[];
  alerts: VisitorAlert[];
}

const activityDot: Record<string, string> = {
  active: "bg-emerald-500",
  idle: "bg-amber-400",
  inactive: "bg-red-400",
};

const activityLabel: Record<string, string> = {
  active: "Actif",
  idle: "Inactif",
  inactive: "Parti ?",
};

function minutesSince(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "A l'instant";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? String(mins % 60).padStart(2, "0") : ""}`;
}

function AlertPill({ alert }: { alert: VisitorAlert }) {
  if (alert.type === "rush") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        Rush : {alert.count} visiteurs !
      </span>
    );
  }
  if (alert.type === "va_commander") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        Va commander !
      </span>
    );
  }
  if (alert.type === "grosse_commande") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
        <ShoppingCart className="h-3 w-3" />
        Grosse commande : {alert.total.toFixed(2)} EUR
      </span>
    );
  }
  if (alert.type === "hesite") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
        <AlertTriangle className="h-3 w-3" />
        Hesite
      </span>
    );
  }
  return null;
}

function SourceIcon({ source }: { source: string }) {
  if (source === "qr") return <QrCode className="h-3.5 w-3.5 text-muted-foreground" />;
  if (source === "link") return <Link2 className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Eye className="h-3.5 w-3.5 text-muted-foreground" />;
}

export const DashboardLiveVisitors = ({ visitors, alerts }: Props) => {
  if (visitors.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Aucun visiteur en ce moment</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Alert pills */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((alert, i) => (
            <AlertPill key={i} alert={alert} />
          ))}
        </div>
      )}

      {/* Visitor cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visitors.map((v) => (
          <motion.div
            key={v.visitor_id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl border border-border p-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${activityDot[v.activity]}`} />
                <span className="text-sm font-medium text-foreground">Visiteur</span>
                {v.device === "mobile" ? (
                  <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <SourceIcon source={v.source} />
              </div>
              <span className="text-xs text-muted-foreground">
                {activityLabel[v.activity]} - {minutesSince(v.arrived_at)}
              </span>
            </div>

            {/* Cart info */}
            {v.cart_count > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                <ShoppingCart className="h-3 w-3" />
                <span>{v.cart_count} article{v.cart_count > 1 ? "s" : ""} - {v.cart_total.toFixed(2)} EUR</span>
              </div>
            )}
            {v.cart_items.length > 0 && (
              <p className="text-xs text-muted-foreground truncate">{v.cart_items.join(", ")}</p>
            )}

            {/* Section badge */}
            {v.page_section === "order_form" ? (
              <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Formulaire de commande
              </span>
            ) : v.page_section.startsWith("category:") ? (
              <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground">
                {v.page_section.replace("category:", "")}
              </span>
            ) : (
              <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground">
                {v.page_section}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
