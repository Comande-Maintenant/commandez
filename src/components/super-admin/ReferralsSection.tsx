import { useState, useEffect } from "react";
import { Gift } from "lucide-react";
import { fetchAllReferrals, type AllReferralsData } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-amber-100 text-amber-800" },
  completed: { label: "Effectue", className: "bg-emerald-100 text-emerald-800" },
  expired: { label: "Expire", className: "bg-red-100 text-red-800" },
};

export const ReferralsSection = () => {
  const [data, setData] = useState<AllReferralsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllReferrals()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-32 rounded-2xl" />;
  if (!data) return null;

  return (
    <Card className="rounded-2xl border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Gift className="h-4 w-4 text-muted-foreground" />
          Parrainages
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active referral codes */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Codes actifs ({data.activeCodes.length})
          </p>
          {data.activeCodes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Aucun code de parrainage</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.activeCodes.map((c) => (
                <div key={c.restaurantId} className="bg-secondary/50 rounded-lg px-3 py-1.5 text-xs">
                  <span className="font-mono font-semibold">{c.referralCode}</span>
                  <span className="text-muted-foreground ml-1.5">{c.restaurantName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Referrals table */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Parrainages effectues ({data.referrals.length})
          </p>
          {data.referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Aucun parrainage enregistre</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Parrain</th>
                    <th className="px-3 py-2">Filleul</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Bonus</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((ref) => {
                    const badge = STATUS_BADGES[ref.status] ?? STATUS_BADGES.pending;
                    return (
                      <tr key={ref.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2.5">{ref.referrerName}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {ref.refereeName ?? ref.refereeEmail ?? "-"}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {ref.bonusWeeks > 0 ? `+${ref.bonusWeeks} sem.` : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {new Date(ref.createdAt).toLocaleDateString("fr-FR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
