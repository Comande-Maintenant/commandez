import { useState, useEffect } from "react";
import { fetchAcquisitionFunnel, type AcquisitionFunnelData } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown } from "lucide-react";

const STEPS = [
  { key: "accounts" as const, label: "Comptes crees" },
  { key: "withRestaurant" as const, label: "Restaurant cree" },
  { key: "inTrial" as const, label: "En essai" },
  { key: "paying" as const, label: "Paiement finalise" },
  { key: "churned" as const, label: "Churn" },
];

export const AcquisitionFunnel = () => {
  const [data, setData] = useState<AcquisitionFunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAcquisitionFunnel()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-48 rounded-2xl" />;
  if (!data) return null;

  const maxValue = Math.max(data.accounts, 1);

  const conversionRate = (from: number, to: number) => {
    if (from === 0) return "-";
    return `${Math.round((to / from) * 100)}%`;
  };

  return (
    <Card className="rounded-2xl border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          Funnel d'acquisition
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const value = data[step.key];
            const widthPercent = Math.max((value / maxValue) * 100, 4);
            const prevValue = i > 0 ? data[STEPS[i - 1].key] : null;
            const isChurn = step.key === "churned";

            return (
              <div key={step.key}>
                {i > 0 && prevValue !== null && (
                  <p className="text-[11px] text-muted-foreground ml-1 mb-1">
                    {conversionRate(prevValue, value)}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-32 sm:w-40 text-xs text-muted-foreground truncate flex-shrink-0">
                    {step.label}
                  </div>
                  <div className="flex-1 h-7 bg-secondary rounded-lg overflow-hidden">
                    <div
                      className={`h-full rounded-lg flex items-center px-2 text-xs font-semibold text-white transition-all ${
                        isChurn ? "bg-red-400" : "bg-[hsl(var(--primary))]"
                      }`}
                      style={{ width: `${widthPercent}%`, minWidth: "2rem" }}
                    >
                      {value}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
