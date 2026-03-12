import { useState, useEffect } from "react";
import { Ticket } from "lucide-react";
import { fetchAllPromoCodes } from "@/lib/api";
import type { DbPromoCode } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const TYPE_LABELS: Record<string, string> = {
  free_days: "Jours gratuits",
  discount_percent: "Remise %",
  discount_fixed: "Remise fixe",
  free_trial_extension: "Extension essai",
};

export const PromoCodesSection = () => {
  const [codes, setCodes] = useState<DbPromoCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllPromoCodes()
      .then(setCodes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-32 rounded-2xl" />;

  return (
    <Card className="rounded-2xl border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Ticket className="h-4 w-4 text-muted-foreground" />
          Codes promo ({codes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 px-4">Aucun code promo</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Valeur</th>
                  <th className="px-4 py-2">Utilisations</th>
                  <th className="px-4 py-2">Actif</th>
                  <th className="px-4 py-2">Valide jusqu'au</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono font-medium">{code.code}</td>
                    <td className="px-4 py-3 text-muted-foreground">{TYPE_LABELS[code.type] ?? code.type}</td>
                    <td className="px-4 py-3">
                      {code.type === "discount_percent" ? `${code.value}%` :
                       code.type === "discount_fixed" ? `${code.value} EUR` :
                       `${code.value}j`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {code.current_uses}{code.max_uses !== null ? `/${code.max_uses}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block h-2 w-2 rounded-full ${code.active ? "bg-emerald-500" : "bg-red-400"}`} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {code.valid_until
                        ? new Date(code.valid_until).toLocaleDateString("fr-FR")
                        : "Illimite"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
