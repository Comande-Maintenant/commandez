import { useState, useEffect } from "react";
import { ArrowLeft, ShoppingBag, Euro, Users, Clock } from "lucide-react";
import { fetchOrders, fetchCustomers } from "@/lib/api";
import type { DbRestaurant, DbOrder, DbCustomer } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type RestaurantWithStats = DbRestaurant & {
  order_count: number;
  revenue: number;
  last_order_at: string | null;
};

interface Props {
  restaurant: RestaurantWithStats;
  onBack: () => void;
}

export const RestaurantDetail = ({ restaurant, onBack }: Props) => {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [customers, setCustomers] = useState<DbCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchOrders(restaurant.id),
      fetchCustomers(restaurant.id).catch(() => [] as DbCustomer[]),
    ]).then(([o, c]) => {
      setOrders(o);
      setCustomers(c);
      setLoading(false);
    });
  }, [restaurant.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const todayOrders = orders.filter((o) => new Date(o.created_at) >= todayStart);
  const monthOrders = orders.filter((o) => new Date(o.created_at) >= monthStart);

  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total), 0);
  const monthRevenue = monthOrders.reduce((s, o) => s + Number(o.total), 0);

  // Average prep time
  const withTimestamps = orders.filter((o) => (o as any).accepted_at && (o as any).completed_at);
  let avgPrepTime = 0;
  if (withTimestamps.length > 0) {
    const totalMins = withTimestamps.reduce((s, o) => {
      return s + (new Date((o as any).completed_at).getTime() - new Date((o as any).accepted_at).getTime()) / 60000;
    }, 0);
    avgPrepTime = totalMins / withTimestamps.length;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
        <div className="flex items-center gap-3">
          {restaurant.image && (
            <img src={restaurant.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
          )}
          <div>
            <h2 className="text-lg font-bold text-foreground">{restaurant.name}</h2>
            <p className="text-xs text-muted-foreground">{restaurant.city} - {restaurant.slug}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Commandes total", value: orders.length, icon: ShoppingBag },
          { label: "CA total", value: `${restaurant.revenue.toFixed(2)} €`, icon: Euro },
          { label: "Clients", value: customers.length, icon: Users },
          { label: "Temps moyen", value: avgPrepTime > 0 ? `${Math.round(avgPrepTime)} min` : "N/A", icon: Clock },
        ].map((kpi) => (
          <Card key={kpi.label} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Aujourd'hui</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commandes</span>
                <span className="font-medium">{todayOrders.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CA</span>
                <span className="font-medium">{todayRevenue.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Panier moyen</span>
                <span className="font-medium">
                  {todayOrders.length > 0 ? (todayRevenue / todayOrders.length).toFixed(2) : "0.00"} €
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Ce mois</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commandes</span>
                <span className="font-medium">{monthOrders.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CA</span>
                <span className="font-medium">{monthRevenue.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Panier moyen</span>
                <span className="font-medium">
                  {monthOrders.length > 0 ? (monthRevenue / monthOrders.length).toFixed(2) : "0.00"} €
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Dernieres commandes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orders.slice(0, 10).map((order) => (
              <div key={order.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                <div>
                  <span className="font-medium text-foreground">#{order.order_number}</span>
                  <span className="text-muted-foreground ml-2">{order.customer_name}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-foreground">{Number(order.total).toFixed(2)} €</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune commande</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
