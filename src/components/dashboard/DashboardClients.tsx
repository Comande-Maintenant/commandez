import { useState, useEffect, useMemo } from "react";
import { Search, Phone, Mail, ShoppingBag, Euro, Star, ShieldBan, ShieldCheck, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { fetchCustomers, unbanCustomer } from "@/lib/api";
import type { DbRestaurant, DbCustomer } from "@/types/database";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BanDialog } from "./BanDialog";
import { toast } from "sonner";

interface Props {
  restaurant: DbRestaurant;
}

type SortKey = "last_order" | "total_orders" | "total_spent";
type FilterKey = "all" | "regulars" | "banned";

export const DashboardClients = ({ restaurant }: Props) => {
  const [customers, setCustomers] = useState<DbCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("last_order");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<DbCustomer | null>(null);

  const loadCustomers = async () => {
    try {
      const data = await fetchCustomers(restaurant.id);
      setCustomers(data);
    } catch {
      toast.error("Erreur chargement clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [restaurant.id]);

  const filtered = useMemo(() => {
    let list = [...customers];

    // Filter
    if (filter === "regulars") list = list.filter((c) => c.total_orders >= 5);
    if (filter === "banned") list = list.filter((c) => c.is_banned);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          c.customer_phone.includes(q) ||
          (c.customer_email && c.customer_email.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sort === "last_order") {
      list.sort((a, b) => {
        if (!a.last_order_at) return 1;
        if (!b.last_order_at) return -1;
        return new Date(b.last_order_at).getTime() - new Date(a.last_order_at).getTime();
      });
    } else if (sort === "total_orders") {
      list.sort((a, b) => b.total_orders - a.total_orders);
    } else if (sort === "total_spent") {
      list.sort((a, b) => Number(b.total_spent) - Number(a.total_spent));
    }

    return list;
  }, [customers, search, sort, filter]);

  const handleUnban = async (customer: DbCustomer) => {
    try {
      await unbanCustomer(customer.id);
      setCustomers((prev) =>
        prev.map((c) => (c.id === customer.id ? { ...c, is_banned: false, banned_at: null, banned_reason: "", ban_expires_at: null } : c))
      );
      toast.success(`${customer.customer_name || customer.customer_phone} debanni`);
    } catch {
      toast.error("Erreur");
    }
  };

  const timeSince = (dateStr: string | null) => {
    if (!dateStr) return "Jamais";
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "A l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    if (mins < 1440) return `Il y a ${Math.floor(mins / 60)}h`;
    const days = Math.floor(mins / 1440);
    if (days < 30) return `Il y a ${days}j`;
    return `Il y a ${Math.floor(days / 30)} mois`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-2xl" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Mes clients</h2>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-2xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Total clients</p>
          <p className="text-2xl font-bold text-foreground">{customers.length}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Reguliers (5+)</p>
          <p className="text-2xl font-bold text-foreground">{customers.filter((c) => c.total_orders >= 5).length}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Bannis</p>
          <p className="text-2xl font-bold text-destructive">{customers.filter((c) => c.is_banned).length}</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, telephone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
        {([
          { id: "all" as FilterKey, label: "Tous" },
          { id: "regulars" as FilterKey, label: "Reguliers" },
          { id: "banned" as FilterKey, label: "Bannis" },
        ]).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[44px] ${
              filter === f.id
                ? "bg-foreground text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="border-l border-border mx-1" />
        {([
          { id: "last_order" as SortKey, label: "Recents" },
          { id: "total_orders" as SortKey, label: "Fideles" },
          { id: "total_spent" as SortKey, label: "CA" },
        ]).map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={`px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[44px] ${
              sort === s.id
                ? "bg-foreground/10 text-foreground border border-foreground/20"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Client list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {customers.length === 0
                ? "Pas encore de client. Ils apparaitront ici apres leur premiere commande terminee."
                : "Aucun client ne correspond a votre recherche."}
            </p>
          </div>
        )}

        {filtered.map((customer) => (
          <div key={customer.id} className="bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">
                    {customer.customer_name || "Client inconnu"}
                  </span>
                  {customer.is_banned && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                      Banni
                    </span>
                  )}
                  {customer.total_orders >= 10 && !customer.is_banned && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      <Star className="h-3 w-3 inline -mt-0.5 mr-0.5" />VIP
                    </span>
                  )}
                  {customer.total_orders >= 5 && customer.total_orders < 10 && !customer.is_banned && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      Regulier
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />{customer.customer_phone}
                  </span>
                  {customer.customer_email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />{customer.customer_email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />{timeSince(customer.last_order_at)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 mt-2 text-sm">
                  <span className="flex items-center gap-1 text-foreground">
                    <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                    {customer.total_orders} commande{customer.total_orders > 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1 text-foreground blur-sensitive">
                    <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                    {Number(customer.total_spent).toFixed(2)} €
                  </span>
                  <span className="text-muted-foreground blur-sensitive">
                    Panier moy. {Number(customer.average_basket).toFixed(2)} €
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <button
                  onClick={() => setExpanded(expanded === customer.id ? null : customer.id)}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  {expanded === customer.id ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {expanded === customer.id && (
              <div className="mt-3 pt-3 border-t border-border space-y-3">
                {customer.favorite_items && (customer.favorite_items as string[]).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Favoris</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(customer.favorite_items as string[]).map((item, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {customer.last_items && (customer.last_items as string[]).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Derniere commande</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(customer.last_items as string[]).map((item, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-full bg-secondary/50 text-muted-foreground">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {customer.is_banned && customer.banned_reason && (
                  <div className="p-2 bg-destructive/5 rounded-lg">
                    <p className="text-xs text-destructive">
                      Raison : {customer.banned_reason}
                      {customer.ban_expires_at && (
                        <> (expire le {new Date(customer.ban_expires_at).toLocaleDateString("fr-FR")})</>
                      )}
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  {customer.is_banned ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl gap-1.5"
                      onClick={() => handleUnban(customer)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Debannir
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setBanTarget(customer)}
                    >
                      <ShieldBan className="h-3.5 w-3.5" />
                      Bannir
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ban dialog */}
      {banTarget && (
        <BanDialog
          customer={banTarget}
          open={!!banTarget}
          onClose={() => setBanTarget(null)}
          onBanned={loadCustomers}
          restaurantId={restaurant.id}
        />
      )}
    </div>
  );
};
