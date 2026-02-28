import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Eye, EyeOff, Volume2, VolumeX } from "lucide-react";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { motion, AnimatePresence } from "framer-motion";
import { fetchRestaurantBySlug, updateRestaurant } from "@/lib/api";
import type { DbRestaurant } from "@/types/database";
import { DashboardOrders } from "@/components/dashboard/DashboardOrders";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardMaCarte } from "@/components/dashboard/DashboardMaCarte";
import { DashboardMaPage } from "@/components/dashboard/DashboardMaPage";
import { DashboardQRCodes } from "@/components/dashboard/DashboardQRCodes";
import { DashboardParametres } from "@/components/dashboard/DashboardParametres";
import { DashboardPOS } from "@/components/dashboard/pos/DashboardPOS";
import { DashboardEnDirect } from "@/components/dashboard/DashboardEnDirect";
import { GererMenu } from "@/components/dashboard/GererMenu";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { AdminBottomNav } from "@/components/dashboard/AdminBottomNav";
import { LiveSummaryBanner } from "@/components/dashboard/LiveSummaryBanner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useLiveVisitors, useLiveOrderCounts } from "@/hooks/useLiveVisitors";

type DashboardView = "cuisine" | "caisse" | "en-direct" | "carte" | "page" | "qrcodes" | "parametres" | "stats" | "gerer";

const validViews: DashboardView[] = ["cuisine", "caisse", "en-direct", "carte", "page", "qrcodes", "parametres", "stats", "gerer"];

function isValidView(v: string): v is DashboardView {
  return validViews.includes(v as DashboardView);
}

const isOpsView = (v: DashboardView) => ["cuisine", "caisse", "en-direct"].includes(v);

const AdminPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<DashboardView>(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const tab = params.get("tab");
    if (view && isValidView(view)) return view;
    // Backward compat
    if (tab === "orders") return "cuisine";
    if (tab === "carte") return "carte";
    if (tab === "caisse") return "caisse";
    if (tab === "settings") return "parametres";
    return "cuisine";
  });
  const [blurred, setBlurred] = useState(() => localStorage.getItem("dashboard-blur") === "true");
  const sound = useNotificationSound();
  const { visitors, alerts } = useLiveVisitors(restaurant?.id ?? null);
  const orderCounts = useLiveOrderCounts(restaurant?.id ?? null);

  useEffect(() => {
    if (!slug) return;
    fetchRestaurantBySlug(slug).then((r) => {
      setRestaurant(r);
      setLoading(false);
    });
  }, [slug]);

  // Sync URL with active view
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("tab");
    url.searchParams.set("view", activeView);
    window.history.replaceState({}, "", url.toString());
  }, [activeView]);

  const handleViewChange = (view: DashboardView) => {
    setActiveView(view);
  };

  const toggleBlur = () => {
    setBlurred((prev) => {
      const next = !prev;
      localStorage.setItem("dashboard-blur", String(next));
      return next;
    });
  };

  const toggleAccepting = async () => {
    if (!restaurant) return;
    const next = !restaurant.is_accepting_orders;
    try {
      await updateRestaurant(restaurant.id, { is_accepting_orders: next } as any);
      setRestaurant({ ...restaurant, is_accepting_orders: next });
      toast.success(next ? "Commandes activees" : "Commandes desactivees");
    } catch {
      toast.error("Erreur lors de la mise a jour");
    }
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
    <div className="min-h-screen bg-secondary/50 lg:flex" data-blurred={blurred}>
      <style>{`[data-blurred="true"] .blur-sensitive { filter: blur(8px); user-select: none; }`}</style>
      <AdminSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        newOrderCount={orderCounts.newCount}
      />

      <div className="flex-1 lg:ml-60 pb-20 lg:pb-0">
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
              {/* Sound toggle (cuisine view) */}
              {isOpsView(activeView) && (
                <button
                  onClick={() => {
                    if (!sound.audioUnlocked) {
                      sound.unlockAudio();
                    }
                    sound.toggleMuted();
                  }}
                  className="p-2 rounded-xl hover:bg-secondary transition-colors"
                  title={sound.muted ? "Activer le son" : "Couper le son"}
                  aria-label={sound.muted ? "Activer le son" : "Couper le son"}
                >
                  {sound.muted || !sound.audioUnlocked ? (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-foreground" />
                  )}
                </button>
              )}

              {/* Blur toggle */}
              <button
                onClick={toggleBlur}
                className="p-2 rounded-xl hover:bg-secondary transition-colors"
                title={blurred ? "Afficher les montants" : "Masquer les montants"}
                aria-label={blurred ? "Afficher les montants" : "Masquer les montants"}
              >
                {blurred ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>

              {/* Disponible toggle */}
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${restaurant.is_accepting_orders ? "bg-[hsl(var(--success))]" : "bg-destructive"}`} />
                <span className={`text-xs font-medium hidden sm:inline ${restaurant.is_accepting_orders ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                  {restaurant.is_accepting_orders ? "Disponible" : "Indisponible"}
                </span>
                <Switch
                  checked={restaurant.is_accepting_orders}
                  onCheckedChange={toggleAccepting}
                  className="scale-90"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
          {/* Audio unlock banner for mobile */}
          {isOpsView(activeView) && !sound.audioUnlocked && (
            <button
              onClick={sound.unlockAudio}
              className="w-full mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
            >
              <Volume2 className="h-4 w-4" />
              Appuyez pour activer le son des notifications
            </button>
          )}

          {/* Reactivation banner */}
          {restaurant.deactivated_at && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm text-amber-900">
                <p className="font-medium">
                  Votre restaurant est desactive depuis le {new Date(restaurant.deactivated_at).toLocaleDateString("fr-FR")}.
                  {(restaurant.deactivation_visit_count > 0) && (
                    <> {restaurant.deactivation_visit_count} personne{restaurant.deactivation_visit_count > 1 ? "s ont" : " a"} essaye de commander.</>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                className="rounded-xl whitespace-nowrap"
                onClick={async () => {
                  try {
                    await updateRestaurant(restaurant.id, {
                      deactivated_at: null,
                      scheduled_deletion_at: null,
                      is_accepting_orders: true,
                      deactivation_visit_count: 0,
                    } as any);
                    setRestaurant({
                      ...restaurant,
                      deactivated_at: null,
                      scheduled_deletion_at: null,
                      is_accepting_orders: true,
                      deactivation_visit_count: 0,
                    });
                    toast.success("Restaurant reactive !");
                  } catch {
                    toast.error("Erreur lors de la reactivation");
                  }
                }}
              >
                Reactiver
              </Button>
            </div>
          )}

          {isOpsView(activeView) && activeView !== "caisse" && (
            <LiveSummaryBanner
              visitors={visitors}
              alerts={alerts}
              orderCounts={orderCounts}
              onNavigate={(v) => handleViewChange(v as DashboardView)}
              compact={false}
            />
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeView === "cuisine" && <DashboardOrders restaurant={restaurant} onNewOrderSound={sound.play} />}
              {activeView === "caisse" && <DashboardPOS restaurant={restaurant} />}
              {activeView === "en-direct" && <DashboardEnDirect restaurant={restaurant} visitors={visitors} alerts={alerts} />}
              {activeView === "carte" && <DashboardMaCarte restaurant={restaurant} />}
              {activeView === "page" && <DashboardMaPage restaurant={restaurant} />}
              {activeView === "qrcodes" && <DashboardQRCodes restaurant={restaurant} />}
              {activeView === "parametres" && <DashboardParametres restaurant={restaurant} sound={sound} />}
              {activeView === "stats" && <DashboardStats restaurant={restaurant} />}
              {activeView === "gerer" && <GererMenu onViewChange={handleViewChange} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AdminBottomNav
        activeView={activeView}
        onViewChange={handleViewChange}
        newOrderCount={orderCounts.newCount}
      />
    </div>
  );
};

export default AdminPage;
