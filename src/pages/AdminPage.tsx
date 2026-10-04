import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { isNative } from '@/lib/native';
import { navigateBack } from '@/lib/navigation';
import { nativePushStatus } from '@/services/native-push-client';
import { DemoOrderControls } from '@/components/DemoOrderControls';
import {MerchantSetup} from '@/components/dashboard/MerchantSetup';
import { NativeOrderNotifications } from '@/components/NativeOrderNotifications';
import { lazy, Suspense, useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Eye, EyeOff, Volume2, VolumeX, X, Clock } from "lucide-react";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useRestaurantOrders } from "@/hooks/useRestaurantOrders";
import { useDashboardRestaurant } from "@/hooks/useDashboardRestaurant";
import { RestaurantOrdersContext } from "@/context/RestaurantOrdersContext";
import { formatDisplayNumber } from "@/lib/orderNumber";
import { motion, AnimatePresence } from "framer-motion";
import { updateRestaurant } from "@/lib/api";
import type { DbRestaurant } from "@/types/database";
import { GererMenu } from "@/components/dashboard/GererMenu";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { AdminBottomNav } from "@/components/dashboard/AdminBottomNav";
import { LiveSummaryBanner } from "@/components/dashboard/LiveSummaryBanner";
import { AssistantChatbot } from "@/components/dashboard/AssistantChatbot";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useLiveVisitors } from "@/hooks/useLiveVisitors";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardView } from "@/types/dashboard";
import { SubscriptionGate } from "@/components/auth/SubscriptionGate";
import { OrderHistorySheet } from "@/components/dashboard/OrderHistorySheet";
import { LanguageSelector } from "@/components/restaurant/LanguageSelector";
import { useLanguage } from "@/context/LanguageContext";

const DashboardOrders = lazy(() => import("@/components/dashboard/DashboardOrders").then((module) => ({ default: module.DashboardOrders })));
const DashboardStats = lazy(() => import("@/components/dashboard/DashboardStats").then((module) => ({ default: module.DashboardStats })));
const DashboardMaCarte = lazy(() => import("@/components/dashboard/DashboardMaCarte").then((module) => ({ default: module.DashboardMaCarte })));
const DashboardMaPage = lazy(() => import("@/components/dashboard/DashboardMaPage").then((module) => ({ default: module.DashboardMaPage })));
const DashboardQRCodes = lazy(() => import("@/components/dashboard/DashboardQRCodes").then((module) => ({ default: module.DashboardQRCodes })));
const DashboardBorneClient = lazy(() => import("@/components/dashboard/DashboardBorneClient").then((module) => ({ default: module.DashboardBorneClient })));
const DashboardParametres = lazy(() => import("@/components/dashboard/DashboardParametres").then((module) => ({ default: module.DashboardParametres })));
const DashboardPOS = lazy(() => import("@/components/dashboard/pos/DashboardPOS").then((module) => ({ default: module.DashboardPOS })));
const DashboardEnDirect = lazy(() => import("@/components/dashboard/DashboardEnDirect").then((module) => ({ default: module.DashboardEnDirect })));
const DashboardClients = lazy(() => import("@/components/dashboard/DashboardClients").then((module) => ({ default: module.DashboardClients })));
const DashboardCustomization = lazy(() => import("@/components/dashboard/DashboardCustomization").then((module) => ({ default: module.DashboardCustomization })));

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
  const { restaurant, setRestaurant, loading, error: restaurantError, retry: retryRestaurant } = useDashboardRestaurant(slug, isDemo);
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
  const { authChecked, authError, authUserId } = useDashboardAuth(isDemo);
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
  const orderFeed = useRestaurantOrders(restaurant && (isDemo || authUserId === restaurant.owner_id) ? restaurant.id : null, {
    isDemo, onNewOrder: order => {
      if (isDemo || !isNative() || nativePushStatus() !== 'enabled') sound.play();
      if (activeView !== 'cuisine') toast.info(t('dashboard.orders.new_order_popup'), { description: formatDisplayNumber(order), duration: 12000 });
    },
  });
  const orderCounts = {
    newCount: orderFeed.orders.filter(order => order.status === 'new').length,
    preparingCount: orderFeed.orders.filter(order => order.status === 'preparing').length,
    readyCount: orderFeed.orders.filter(order => order.status === 'ready').length,
  };
  const [historyOpen, setHistoryOpen] = useState(false);

  // The actionable guide is inline. The legacy tour is opt-in from help only.
  useEffect(() => {
    if (!restaurant?.slug || isDemo || new URLSearchParams(window.location.search).get('tour')!=='1') return;
    let completed = false;
    try { completed = Boolean(localStorage.getItem(`cm_onboarding_done_${restaurant.slug}`)); } catch { /* show the tour if preferences cannot be read */ }
    if (completed) return;
    const timeout = setTimeout(() => setShowOnboarding(true), 1000);
    return () => clearTimeout(timeout);
  }, [restaurant?.slug,isDemo]);

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
    window.history.replaceState(window.history.state, "", url.toString());
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

  if (!isDemo && authError === 'unavailable') {
    return (
      <div role="alert" className="min-h-screen flex flex-col gap-4 items-center justify-center bg-background">
        <p>{t('auth.generic_error')}</p>
        <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
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

  if (restaurantError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div role="alert" className="text-center space-y-4">
          <p>{t('auth.generic_error')}</p>
          <Button onClick={retryRestaurant}>{t('common.retry')}</Button>
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
    <RestaurantOrdersContext.Provider value={orderFeed}>
    <div className="min-h-screen bg-secondary/50 lg:flex" data-blurred={blurred}>
      <style>{`[data-blurred="true"] .blur-sensitive { filter: blur(8px); user-select: none; }`}</style>

      <AdminSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        newOrderCount={orderCounts.newCount}
        readyOrderCount={orderCounts.readyCount}
      />

      <div className="flex-1 lg:ms-60 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
        {/* Header (+ demo banner) - single sticky block */}
        <div data-dashboard-header className="sticky top-0 z-40">
          {isDemo && !demoBannerDismissed && (
            <div className="bg-primary text-white">
              <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 text-xs font-medium leading-relaxed break-words">
                  {t("demo.banner_text")}
                </p>
                <div className="flex items-center gap-1 flex-shrink-0 ms-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-auto min-h-11 w-24 rounded-lg whitespace-normal break-words px-2 py-2 text-xs font-semibold leading-snug bg-white text-primary hover:bg-secondary"
                    onClick={() => navigate("/inscription")}
                  >
                    {t("demo.banner_cta")}
                  </Button>
                  <button
                    onClick={() => { setDemoBannerDismissed(true); sessionStorage.setItem("demo_banner_dismissed", "1"); }}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                    aria-label={t("dashboard.admin.close")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
          <header className="bg-background border-b border-border">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-14 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-auto">
              <button onClick={() => navigateBack(navigate,isDemo?'/decouvrir':'/')} aria-label={t('nav.back')} className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-secondary transition-colors flex-shrink-0">
                <ArrowLeft className={`h-5 w-5 text-foreground ${isRTL ? 'scale-x-[-1]' : ''}`} />
              </button>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-semibold text-foreground truncate">{restaurant.name}</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">{t("dashboard.admin.dashboard_subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center justify-end w-full sm:w-auto gap-1.5 sm:gap-3 flex-shrink-0">
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
                  className={`min-h-11 min-w-11 p-2 rounded-xl hover:bg-secondary transition-colors ${sound.isRepeating ? "animate-pulse" : ""}`}
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
                  className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-secondary transition-colors relative"
                  title={t("dashboard.history.title")}
                  aria-label={t("dashboard.history.title")}
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {orderCounts.newCount + orderCounts.preparingCount > 0 && (
                    <span className="absolute -top-0.5 -end-0.5 h-4 min-w-4 px-0.5 flex items-center justify-center rounded-full bg-primary text-white text-[9px] font-bold">
                      {orderCounts.newCount + orderCounts.preparingCount}
                    </span>
                  )}
                </button>
              )}

              {/* Blur toggle - only on views with monetary amounts */}
              {["en-direct", "stats", "clients"].includes(activeView) && (
                <button
                  onClick={toggleBlur}
                  className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-secondary transition-colors"
                  title={blurred ? t("dashboard.admin.show_amounts") : t("dashboard.admin.hide_amounts")}
                  aria-label={blurred ? t("dashboard.admin.show_amounts") : t("dashboard.admin.hide_amounts")}
                >
                  {blurred ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
              )}

              {/* Language selector */}
              <LanguageSelector />

              {/* Separator + Disponible toggle */}
              <div className="h-5 w-px bg-border/60 ms-1 sm:ms-1.5 flex-shrink-0" />
              <div className="flex items-center gap-2 ms-1 sm:ms-1.5" data-tour="disponible">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${restaurant.is_accepting_orders ? "bg-[hsl(var(--success))]" : "bg-destructive"}`} />
                <span className={`text-xs font-medium hidden md:inline ${restaurant.is_accepting_orders ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                  {restaurant.is_accepting_orders ? t("dashboard.admin.available") : t("dashboard.admin.unavailable")}
                </span>
                <label htmlFor="dashboard-accepting-orders" className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                  <Switch id="dashboard-accepting-orders" aria-label={t(restaurant.is_accepting_orders ? "dashboard.admin.available" : "dashboard.admin.unavailable")} checked={restaurant.is_accepting_orders} onCheckedChange={toggleAccepting} />
                </label>
              </div>
            </div>
          </div>
          </header>
        </div>

        {/* Main content */}
        <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
          {isDemo && (activeView === "cuisine" || activeView === "caisse") && <DemoOrderControls restaurantId={restaurant.id} onNavigate={handleViewChange} compact={activeView==='caisse'} />}
          {!isDemo && authUserId===restaurant.owner_id && (activeView==='cuisine'||activeView==='gerer') && <MerchantSetup key={`${authUserId}_${restaurant.id}`} restaurant={restaurant} ownerUserId={authUserId} onNavigate={handleViewChange}/>}
          {!isDemo && <NativeOrderNotifications ownerUserId={restaurant.owner_id} />}
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

          {/* Prospect banner */}
          {(restaurant as any)?.account_status === "prospect" && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-blue-900">
                <p className="font-medium">{t('commerce.free_title')}</p>
                <p className="text-blue-700">{t('commerce.free_desc')}</p>
              </div>
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin" /></div>}>
                {activeView === "cuisine" && <DashboardOrders restaurant={restaurant} isDemo={isDemo} />}
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
              </Suspense>
              {activeView === "gerer" && <GererMenu onViewChange={handleViewChange} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AdminBottomNav
        activeView={activeView}
        onViewChange={handleViewChange}
        newOrderCount={orderCounts.newCount}
        readyOrderCount={orderCounts.readyCount}
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

      {/* Assistant chatbot - only on settings tab */}
      {activeView === "parametres" && (
        <AssistantChatbot
          activeView={activeView}
          onNavigate={(v) => handleViewChange(v as DashboardView)}
        />
      )}

      {/* Onboarding tour */}
      {showOnboarding && restaurant && (
        <OnboardingTour
          onComplete={() => {
            setShowOnboarding(false);
            localStorage.setItem(`cm_onboarding_done_${restaurant.slug}`, "true");
          }}
        />
      )}
    </div>
    </RestaurantOrdersContext.Provider>
  );

  // Skip SubscriptionGate for demo and prospect restaurants
  const isProspect = (restaurant as any)?.account_status === "prospect";
  if (isDemo || isProspect) {
    return dashboardContent;
  }

  return (
    <SubscriptionGate restaurantId={restaurant.id}>
      {dashboardContent}
    </SubscriptionGate>
  );
};

export default AdminPage;
