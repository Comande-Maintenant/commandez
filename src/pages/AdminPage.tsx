import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, LayoutGrid, UtensilsCrossed, Clock, BarChart3, Loader2, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchRestaurantBySlug } from "@/lib/api";
import type { DbRestaurant } from "@/types/database";
import { DashboardOrders } from "@/components/dashboard/DashboardOrders";
import { DashboardMenu } from "@/components/dashboard/DashboardMenu";
import { DashboardHours } from "@/components/dashboard/DashboardHours";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { Button } from "@/components/ui/button";

const tabs = [
  { id: "orders", label: "Commandes", icon: LayoutGrid },
  { id: "menu", label: "Menu", icon: UtensilsCrossed },
  { id: "hours", label: "Horaires", icon: Clock },
  { id: "stats", label: "Statistiques", icon: BarChart3 },
] as const;

type TabId = (typeof tabs)[number]["id"];

const AdminPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("orders");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetchRestaurantBySlug(slug).then((r) => {
      setRestaurant(r);
      setLoading(false);
    });
  }, [slug]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Restaurant introuvable</h1>
          <Link to="/" className="text-muted-foreground hover:text-foreground mt-4 inline-block text-sm underline">← Retour</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/50">
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/${slug}`} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-foreground">{restaurant.name}</h1>
              <p className="text-xs text-muted-foreground">Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copié !" : "Copier le lien"}
            </Button>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${restaurant.is_open ? "bg-[hsl(var(--success))]" : "bg-muted-foreground"}`} />
              <span className="text-xs font-medium text-muted-foreground">{restaurant.is_open ? "Ouvert" : "Fermé"}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {activeTab === "orders" && <DashboardOrders restaurant={restaurant} />}
            {activeTab === "menu" && <DashboardMenu restaurant={restaurant} />}
            {activeTab === "hours" && <DashboardHours restaurant={restaurant} />}
            {activeTab === "stats" && <DashboardStats restaurant={restaurant} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AdminPage;
