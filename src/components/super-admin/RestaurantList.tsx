import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { fetchProspectList, type ProspectItem } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  onSelect: (restaurant: any) => void;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  trial: { label: "Essai", className: "bg-blue-100 text-blue-800" },
  promo: { label: "Promo", className: "bg-blue-100 text-blue-800" },
  active: { label: "Actif", className: "bg-emerald-100 text-emerald-800" },
  pending_payment: { label: "Paiement en attente", className: "bg-amber-100 text-amber-800" },
  past_due: { label: "Impaye", className: "bg-orange-100 text-orange-800" },
  cancelled: { label: "Annule", className: "bg-red-100 text-red-800" },
  expired: { label: "Expire", className: "bg-red-100 text-red-800" },
};

export const RestaurantList = ({ onSelect }: Props) => {
  const [prospects, setProspects] = useState<ProspectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchProspectList()
      .then(setProspects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return prospects;
    const q = search.toLowerCase();
    return prospects.filter(
      (p) =>
        p.email.toLowerCase().includes(q) ||
        p.restaurantName?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q)
    );
  }, [prospects, search]);

  const trialDaysLeft = (trialEnd: string | null) => {
    if (!trialEnd) return null;
    const days = Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 0) return "Expire";
    return `${days}j`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <Card className="rounded-2xl border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Prospects / Clients</CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par email, nom, telephone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Telephone</th>
                <th className="px-4 py-2">Restaurant</th>
                <th className="px-4 py-2">Inscription</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Trial</th>
                <th className="px-4 py-2">Plan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const badge = STATUS_BADGES[p.subscriptionStatus ?? ""] ?? null;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => p.restaurantId && onSelect({ id: p.restaurantId, name: p.restaurantName, slug: p.restaurantSlug })}
                  >
                    <td className="px-4 py-3 font-medium truncate max-w-[200px]">{p.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.phone || "-"}</td>
                    <td className="px-4 py-3">{p.restaurantName || <span className="text-muted-foreground italic">Aucun</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      {badge ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {trialDaysLeft(p.trialEndDate) ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{p.plan ?? "-"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                    Aucun prospect trouve
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-2 p-4">
          {filtered.map((p) => {
            const badge = STATUS_BADGES[p.subscriptionStatus ?? ""] ?? null;
            return (
              <div
                key={p.id}
                onClick={() => p.restaurantId && onSelect({ id: p.restaurantId, name: p.restaurantName, slug: p.restaurantSlug })}
                className="bg-secondary/30 rounded-xl p-3 space-y-1 cursor-pointer"
              >
                <p className="text-sm font-medium truncate">{p.email}</p>
                <p className="text-xs text-muted-foreground">{p.restaurantName || "Pas de restaurant"}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {badge && (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                  {p.trialEndDate && (
                    <span className="text-[11px] text-muted-foreground">
                      Trial: {trialDaysLeft(p.trialEndDate)}
                    </span>
                  )}
                  {p.plan && (
                    <span className="text-[11px] text-muted-foreground capitalize">{p.plan}</span>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center py-8 text-sm text-muted-foreground">Aucun prospect trouve</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
