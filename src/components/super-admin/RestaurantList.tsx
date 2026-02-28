import { useState, useEffect, useMemo } from "react";
import { Search, Store, ShoppingBag, Euro, Calendar } from "lucide-react";
import { fetchAllRestaurantsWithStats } from "@/lib/api";
import type { DbRestaurant } from "@/types/database";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type RestaurantWithStats = DbRestaurant & {
  order_count: number;
  revenue: number;
  last_order_at: string | null;
};

interface Props {
  onSelect: (restaurant: RestaurantWithStats) => void;
}

export const RestaurantList = ({ onSelect }: Props) => {
  const [restaurants, setRestaurants] = useState<RestaurantWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "orders" | "revenue">("orders");

  useEffect(() => {
    fetchAllRestaurantsWithStats()
      .then(setRestaurants)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...restaurants];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || r.city?.toLowerCase().includes(q) || r.slug.includes(q)
      );
    }
    if (sortBy === "orders") list.sort((a, b) => b.order_count - a.order_count);
    if (sortBy === "revenue") list.sort((a, b) => b.revenue - a.revenue);
    if (sortBy === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [restaurants, search, sortBy]);

  const timeSince = (dateStr: string | null) => {
    if (!dateStr) return "Aucune";
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins} min`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}j`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un restaurant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          {([
            { id: "orders" as const, label: "Commandes" },
            { id: "revenue" as const, label: "CA" },
            { id: "name" as const, label: "Nom" },
          ]).map((s) => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              className={`px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                sortBy === s.id
                  ? "bg-foreground text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className="w-full text-left bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              {r.image ? (
                <img src={r.image} alt="" className="h-10 w-10 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                  <Store className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${r.is_accepting_orders ? "bg-emerald-500" : "bg-red-500"}`} />
                </div>
                <p className="text-xs text-muted-foreground">{r.city || r.slug}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />{r.order_count} commandes
              </span>
              <span className="flex items-center gap-1">
                <Euro className="h-3 w-3" />{r.revenue.toFixed(2)} €
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />Derniere : {timeSince(r.last_order_at)}
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-8 text-sm text-muted-foreground">Aucun restaurant trouve</p>
        )}
      </div>
    </div>
  );
};
