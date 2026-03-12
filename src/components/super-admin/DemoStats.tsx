import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, ShoppingBag, Euro, Clock } from "lucide-react";
import { fetchDemoStats, type DemoStatsData } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const DemoStats = () => {
  const [data, setData] = useState<DemoStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchDemoStats()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-12 rounded-2xl" />;
  if (!data) return null;

  const timeSince = (dateStr: string | null) => {
    if (!dateStr) return "Jamais";
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `il y a ${mins} min`;
    if (mins < 1440) return `il y a ${Math.floor(mins / 60)}h`;
    return `il y a ${Math.floor(mins / 1440)}j`;
  };

  return (
    <Card className="rounded-2xl border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <p className="text-sm font-semibold text-foreground">Demo ({data.totalOrders} commandes)</p>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 px-4">
          <p className="text-[11px] text-muted-foreground mb-3 italic">
            Commandes de demonstration, pas du revenu commandeici.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <ShoppingBag className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{data.totalOrders}</p>
              <p className="text-[11px] text-muted-foreground">Commandes</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <Euro className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{data.totalRevenue.toFixed(2)} EUR</p>
              <p className="text-[11px] text-muted-foreground">CA demo</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <Clock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-sm font-bold text-foreground">{timeSince(data.lastOrderAt)}</p>
              <p className="text-[11px] text-muted-foreground">Derniere</p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
