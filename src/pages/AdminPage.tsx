import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Eye, EyeOff, Volume2, VolumeX, X, Clock } from "lucide-react";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { motion, AnimatePresence } from "framer-motion";
import { fetchRestaurantBySlug, fetchDemoRestaurant, updateRestaurant } from "@/lib/api";
import type { DbRestaurant } from "@/types/database";
import { DashboardOrders } from "@/components/dashboard/DashboardOrders";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardMaCarte } from "@/components/dashboard/DashboardMaCarte";
import { DashboardMaPage } from "@/components/dashboard/DashboardMaPage";
import { DashboardQRCodes } from "@/components/dashboard/DashboardQRCodes";
import { DashboardBorneClient } from "@/components/dashboard/DashboardBorneClient";
import { DashboardParametres } from "@/components/dashboard/DashboardParametres";
import { DashboardPOS } from "@/components/dashboard/pos/DashboardPOS";
import { DashboardEnDirect } from "@/components/dashboard/DashboardEnDirect";
import { DashboardClients } from "@/components/dashboard/DashboardClients";
import { GererMenu } from "@/components/dashboard/GererMenu";
import { DashboardCustomization } from "@/components/dashboard/DashboardCustomization";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { AdminBottomNav } from "@/components/dashboard/AdminBottomNav";
import { LiveSummaryBanner } from "@/components/dashboard/LiveSummaryBanner";
import { AssistantChatbot } from "@/components/dashboard/AssistantChatbot";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useLiveVisitors, useLiveOrderCounts } from "@/hooks/useLiveVisitors";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardView } from "@/types/dashboard";
import { SubscriptionGate } from "@/components/auth/SubscriptionGate";
import { OrderHistorySheet } from "@/components/dashboard/OrderHistorySheet";
import { LanguageSelector } from "@/components/restaurant/LanguageSelector";
import { useLanguage } from "@/context/LanguageContext";

const validViews: DashboardView[] = ["cuisine", "caisse", "en-direct", "carte", "page", "qrcodes", "borne", "parametres", "stats", "gerer", "clients", "customization"];

function isValidView(v: string): v is DashboardView {
  return validViews.includes(v as DashboardView);
}

const isOpsView = (v: DashboardView) => ["cuisine", "caisse", "en-direct"].includes(v);

const AdminPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const isDemo = slug === "demo";
  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(() => sessionStorage.getItem("demo_banner_dismissed") === "1");
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
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);
  const sound = useNotificationSound();

  // Auto-unlock audio on user interaction (keep trying until unlocked)
  useEffect(() => {
    if (sound.audioUnlocked) return;
    const handler = () => {
      sound.unlockAudio();
    };
    document.addEventListener("click", handler, { passive: true });
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [sound.audioUnlocked, sound.unlockAudio]);

  const { visitors, alerts } = useLiveVisitors(restaurant?.id ?? null);
  const orderCounts = useLiveOrderCounts(restaurant?.id ?? null);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Auth check - skip for demo
  useEffect(() => {
    if (isDemo) {
      setAuthChecked(true);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setAuthError("not_logged_in");
      } else {
        setAuthUserId(data.user.id);
      }
      setAuthChecked(true);
    });
  }, [isDemo]);

  // Fetch restaurant - use demo RPC for demo mode
  useEffect(() => {
    if (!slug) return;
    const fetchFn = isDemo ? fetchDemoRestaurant(slug) : fetchRestaurantBySlug(slug);
    fetchFn.then((r) => {
      setRestaurant(r);
      setLoading(false);
      // No onboarding tour for demo
      if (r && !isDemo && !localStorage.getItem(`cm_onboarding_done_${r.slug}`)) {
        setTimeout(() => setShowOnboarding(true), 1000);
      }
    });
  }, [slug, isDemo]);

  // PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPwaPrompt(e);
      const isTablet = navigator.maxTouchPoints > 0 && window.innerWidth >= 768;
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      if (isTablet && !isStandalone && !localStorage.getItem("cm_pwa_dismissed")) {
        setShowPwaBanner(true);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

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
    if (isDemo) {
      setRestaurant({ ...restaurant, is_accepting_orders: !restaurant.is_accepting_orders });
      toast.success(!restaurant.is_accepting_orders ? t("dashboard.admin.orders_enabled") : t("dashboard.admin.orders_disabled"));
      return;
    }
    const next = !restaurant.is_accepting_orders;
    try {
      await updateRestaurant(restaurant.id, { is_accepting_orders: next } as any);
      setRestaurant({ ...restaurant, is_accepting_orders: next });
      toast.success(next ? t("dashboard.admin.orders_enabled") : t("dashboard.admin.orders_disabled"));
    } catch {
      toast.error(t("dashboard.admin.update_error"));
    }
  };

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Auth gate - skip for demo
  if (!isDemo && authError === "not_logged_in") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("dashboard.admin.login_required")}</h1>
          <p className="text-muted-foreground mb-4">{t("dashboard.admin.login_required_desc")}</p>
          <Link to="/connexion" className="text-sm text-foreground underline">{t("dashboard.admin.login")}</Link>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{t("dashboard.admin.not_found")}</h1>
          <Link to="/connexion" className="text-muted-foreground hover:text-foreground mt-4 inline-block text-sm underline">{t("dashboard.admin.back")}</Link>
        </div>
      </div>
    );
  }

  // Owner check - skip for demo
  if (!isDemo && (!restaurant.owner_id || !authUserId || authUserId !== restaurant.owner_id)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("dashboard.admin.access_denied")}</h1>
          <p className="text-muted-foreground mb-4">{t("dashboard.admin.not_owner")}</p>
          <Link to="/connexion" className="text-sm text-foreground underline">{t("dashboard.admin.back")}</Link>
        </div>
      </div>
    );
  }

  const dashboardContent = (
    <div className="min-h-screen bg-secondary/50 lg:flex" data-blurred={blurred}>
      <style>{`[data-blurred="true"] .blur-sensitive { filter: blur(8px); user-select: none; }`}</style>

      <AdminSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        newOrderCount={orderCounts.newCount}
      />

      <div className="flex-1 lg:ms-60 pb-20 lg:pb-0">
        {/* Header (+ demo banner) - single sticky block */}
        <div className="sticky top-0 z-50">
          {isDemo && !demoBannerDismissed && (
            <div className="bg-emerald-500 text-white">
              <div className="max-w-6xl mx-auto px-4 h-8 flex items-center justify-between">
                <p className="text-[11px] font-medium truncate">
                  {t("demo.banner_text")}
                </p>
                <div className="flex items-center gap-1 flex-shrink-0 ms-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-lg text-[11px] font-semibold h-6 px-2 bg-white text-emerald-700 hover:bg-emerald-50"
                    onClick={() => navigate("/inscription")}
                  >
                    {t("demo.banner_cta")}
                  </Button>
                  <button
                    onClick={() => { setDemoBannerDismissed(true); sessionStorage.setItem("demo_banner_dismissed", "1"); }}
                    className="p-1 rounded hover:bg-emerald-600 transition-colors"
                    aria-label={t("dashboard.admin.close")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
          <header className="bg-background border-b border-border">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate(-1)} className="p-2 -ms-2 rounded-xl hover:bg-secondary transition-colors flex-shrink-0">
                <ArrowLeft className={`h-5 w-5 text-foreground ${isRTL ? 'scale-x-[-1]' : ''}`} />
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-foreground truncate">{restaurant.name}</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">{t("dashboard.admin.dashboard_subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Sound toggle (cuisine view) */}
              {isOpsView(activeView) && (
                <button
                  data-tour="son"
                  onClick={() => {
                    if (sound.isRepeating) {
                      sound.stopRepeat();
                      return;
                    }
                    if (!sound.audioUnlocked) {
                      sound.unlockAudio();
                    }
                    sound.toggleMuted();
                  }}
                  className={`p-2 rounded-xl hover:bg-secondary transition-colors ${sound.isRepeating ? "animate-pulse" : ""}`}
                  title={sound.isRepeating ? t("dashboard.admin.stop_alert") : sound.muted ? t("dashboard.admin.enable_sound") : t("dashboard.admin.mute_sound")}
                  aria-label={sound.isRepeating ? t("dashboard.admin.stop_alert") : sound.muted ? t("dashboard.admin.enable_sound") : t("dashboard.admin.mute_sound")}
                >
                  {sound.isRepeating ? (
                    <Volume2 className="h-4 w-4 text-emerald-500" />
                  ) : sound.muted || !sound.audioUnlocked ? (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-foreground" />
                  )}
                </button>
              )}

              {/* History button */}
              {isOpsView(activeView) && (
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="p-2 rounded-xl hover:bg-secondary transition-colors relative"
                  title={t("dashboard.history.title")}
                  aria-label={t("dashboard.history.title")}
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {orderCounts.newCount + orderCounts.preparingCount > 0 && (
                    <span className="absolute -top-0.5 -end-0.5 h-4 min-w-4 px-0.5 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[9px] font-bold">
                      {orderCounts.newCount + orderCounts.preparingCount}
                    </span>
                  )}
                </button>
              )}

              {/* Blur toggle - only on views with monetary amounts */}
              {["cuisine", "caisse", "en-direct", "stats", "clients"].includes(activeView) && (
                <button
                  onClick={toggleBlur}
                  className="p-2 rounded-xl hover:bg-secondary transition-colors"
                  title={blurred ? t("dashboard.admin.show_amounts") : t("dashboard.admin.hide_amounts")}
                  aria-label={blurred ? t("dashboard.admin.show_amounts") : t("dashboard.admin.hide_amounts")}
                >
                  {blurred ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
              )}

              {/* Language selector */}
              <LanguageSelector />

              {/* Disponible toggle */}
              <div className="flex items-center gap-2" data-tour="disponible">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${restaurant.is_accepting_orders ? "bg-[hsl(var(--success))]" : "bg-destructive"}`} />
                <span className={`text-xs font-medium hidden sm:inline ${restaurant.is_accepting_orders ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                  {restaurant.is_accepting_orders ? t("dashboard.admin.available") : t("dashboard.admin.unavailable")}
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
        </div>

        {/* Main content */}
        <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
          {/* Audio unlock banner for mobile */}
          {isOpsView(activeView) && !sound.audioUnlocked && (
            <button
              onClick={sound.unlockAudio}
              className="w-full mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
            >
              <Volume2 className="h-4 w-4" />
              {t("dashboard.admin.enable_sound_prompt")}
            </button>
          )}

          {/* Reactivation banner - not in demo */}
          {!isDemo && restaurant.deactivated_at && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm text-amber-900">
                <p className="font-medium">
                  {t("dashboard.admin.disabled_since").replace("{date}", new Date(restaurant.deactivated_at).toLocaleDateString("fr-FR"))}
                  {(restaurant.deactivation_visit_count > 0) && (
                    <>{" "}{t("dashboard.admin.people_tried").replace("{count}", String(restaurant.deactivation_visit_count))}</>
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
                    toast.success(t("dashboard.admin.restaurant_reactivated"));
                  } catch {
                    toast.error(t("dashboard.admin.reactivation_error"));
                  }
                }}
              >
                {t("dashboard.admin.reactivate")}
              </Button>
            </div>
          )}

          {isOpsView(activeView) && activeView !== "caisse" && activeView !== "cuisine" && (
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
              {activeView === "cuisine" && <DashboardOrders restaurant={restaurant} onNewOrderSound={sound.play} isDemo={isDemo} />}
              {activeView === "caisse" && <DashboardPOS restaurant={restaurant} isDemo={isDemo} />}
              {activeView === "en-direct" && <DashboardEnDirect restaurant={restaurant} visitors={visitors} alerts={alerts} isDemo={isDemo} />}
              {activeView === "carte" && <DashboardMaCarte restaurant={restaurant} isDemo={isDemo} />}
              {activeView === "page" && <DashboardMaPage restaurant={restaurant} isDemo={isDemo} />}
              {activeView === "qrcodes" && <DashboardQRCodes restaurant={restaurant} />}
              {activeView === "borne" && <DashboardBorneClient restaurant={restaurant} />}
              {activeView === "parametres" && <DashboardParametres restaurant={restaurant} sound={sound} isDemo={isDemo} />}
              {activeView === "stats" && <DashboardStats restaurant={restaurant} isDemo={isDemo} />}
              {activeView === "clients" && <DashboardClients restaurant={restaurant} isDemo={isDemo} />}
              {activeView === "customization" && <DashboardCustomization restaurant={restaurant} />}
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

      {/* PWA install banner - not in demo */}
      {!isDemo && showPwaBanner && (
        <div className="fixed bottom-16 lg:bottom-4 inset-x-4 z-50 max-w-md mx-auto">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t("dashboard.admin.install_app")}</p>
              <p className="text-xs text-muted-foreground">{t("dashboard.admin.quick_access")}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl text-xs"
                onClick={() => {
                  setShowPwaBanner(false);
                  localStorage.setItem("cm_pwa_dismissed", "true");
                }}
              >
                {t("dashboard.admin.later")}
              </Button>
              <Button
                size="sm"
                className="rounded-xl text-xs"
                onClick={() => {
                  pwaPrompt?.prompt();
                  setShowPwaBanner(false);
                }}
              >
                {t("dashboard.admin.install_button")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Order history sheet */}
      {restaurant && (
        <OrderHistorySheet
          restaurantId={restaurant.id}
          isDemo={isDemo}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Assistant chatbot - only in "gerer" admin views */}
      {!isOpsView(activeView) && (
        <AssistantChatbot
          activeView={activeView}
          onNavigate={(v) => handleViewChange(v as DashboardView)}
        />
      )}

      {/* Onboarding tour - not in demo */}
      {!isDemo && showOnboarding && restaurant && (
        <OnboardingTour
          onComplete={() => {
            setShowOnboarding(false);
            localStorage.setItem(`cm_onboarding_done_${restaurant.slug}`, "true");
          }}
        />
      )}
    </div>
  );

  // Skip SubscriptionGate for demo
  if (isDemo) {
    return dashboardContent;
  }

  return (
    <SubscriptionGate restaurantId={restaurant.id}>
      {dashboardContent}
    </SubscriptionGate>
  );
};

export default AdminPage;
