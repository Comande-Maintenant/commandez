import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ClipboardList, UtensilsCrossed, Palette, Settings, Loader2, Copy, Check, BarChart3, Receipt } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchRestaurantBySlug } from "@/lib/api";
import type { DbRestaurant } from "@/types/database";
import { DashboardOrders } from "@/components/dashboard/DashboardOrders";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardMaCarte } from "@/components/dashboard/DashboardMaCarte";
import { DashboardMaPage } from "@/components/dashboard/DashboardMaPage";
import { DashboardParametres } from "@/components/dashboard/DashboardParametres";
import { DashboardPOS } from "@/components/dashboard/pos/DashboardPOS";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const tabs = [
  { id: "orders", label: "Commandes", icon: ClipboardList },
  { id: "carte", label: "Ma Carte", icon: UtensilsCrossed },
  { id: "page", label: "Ma Page", icon: Palette },
  { id: "settings", label: "Parametres", icon: Settings },
  { id: "caisse", label: "Caisse", icon: Receipt },
] as const;

type TabId = (typeof tabs)[number]["id"];

const AdminPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && tabs.some((t) => t.id === tab)) return tab as TabId;
    return "orders";
  });
  const [showStats, setShowStats] = useState(false);
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
    toast.success("Lien copie !");
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
          <Link to="/" className="text-muted-foreground hover:text-foreground mt-4 inline-block text-sm underline">Retour</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/50 pb-20 sm:pb-0">
      {/* Header */}
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={`/${slug}`} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors flex-shrink-0">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-foreground truncate">{restaurant.name}</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? "Copie !" : "Copier le lien"}</span>
            </Button>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${restaurant.is_open ? "bg-[hsl(var(--success))]" : "bg-muted-foreground"}`} />
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">{restaurant.is_open ? "Ouvert" : "Ferme"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop/Tablet tabs - top bar */}
      <div className="hidden sm:block bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setShowStats(false); }}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab + (showStats ? "-stats" : "")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {activeTab === "orders" && !showStats && (
              <div>
                <div className="flex items-center justify-end mb-4">
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setShowStats(true)}>
                    <BarChart3 className="h-4 w-4" />Statistiques
                  </Button>
                </div>
                <DashboardOrders restaurant={restaurant} />
              </div>
            )}
            {activeTab === "orders" && showStats && (
              <div>
                <div className="flex items-center justify-end mb-4">
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setShowStats(false)}>
                    <ClipboardList className="h-4 w-4" />Commandes
                  </Button>
                </div>
                <DashboardStats restaurant={restaurant} />
              </div>
            )}
            {activeTab === "carte" && <DashboardMaCarte restaurant={restaurant} />}
            {activeTab === "page" && <DashboardMaPage restaurant={restaurant} />}
            {activeTab === "settings" && <DashboardParametres restaurant={restaurant} />}
            {activeTab === "caisse" && <DashboardPOS restaurant={restaurant} onClose={() => setActiveTab("orders")} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setShowStats(false); }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors min-h-[56px] justify-center ${
                activeTab === tab.id ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default AdminPage;
