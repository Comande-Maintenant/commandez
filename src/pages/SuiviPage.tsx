import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Inbox, ChefHat, Timer, CheckCircle, Phone, ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchOrderById, subscribeToOrderStatus, advanceDemoOrder } from "@/lib/api";
import { formatDisplayNumber } from "@/lib/orderNumber";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DbOrder } from "@/types/database";

type OrderStatus = DbOrder["status"];

interface StepDef {
  key: string;
  label: string;
  icon: typeof Inbox;
  matchStatuses: OrderStatus[];
}

const STEPS: StepDef[] = [
  { key: "received", label: "suivi.received", icon: Inbox, matchStatuses: ["new", "preparing", "ready", "done"] },
  { key: "preparing", label: "suivi.preparing", icon: ChefHat, matchStatuses: ["preparing", "ready", "done"] },
  { key: "almost", label: "suivi.almost_ready", icon: Timer, matchStatuses: ["ready", "done"] },
  { key: "ready", label: "suivi.ready", icon: CheckCircle, matchStatuses: ["ready", "done"] },
];

function getStepIndex(status: OrderStatus, elapsedRatio: number): number {
  if (status === "done" || status === "ready") return 3;
  if (status === "preparing" && elapsedRatio > 0.85) return 2;
  if (status === "preparing") return 1;
  return 0;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Simple confetti canvas effect
function launchConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#10B981", "#22C55E", "#3B82F6", "#EAB308", "#EC4899", "#8B5CF6"];
  const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number; life: number }[] = [];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 14 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 3,
      life: 1,
    });
  }

  let frame = 0;
  const animate = () => {
    if (frame > 90) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life -= 0.012;
      if (p.life <= 0) continue;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    frame++;
    requestAnimationFrame(animate);
  };
  animate();
}

const ORDER_TYPE_KEYS: Record<string, string> = {
  collect: "suivi.takeaway",
  dine_in: "suivi.dine_in",
};

const SuiviPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isLoggedIn, signUp } = useCustomerAuth();
  const [order, setOrder] = useState<(DbOrder & { restaurant: { name: string; slug: string; primary_color: string; phone: string; is_demo?: boolean } }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const confettiFiredRef = useRef(false);
  const [signupPassword, setSignupPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [profileDismissed, setProfileDismissed] = useState(() => {
    try { return localStorage.getItem("cm_profile_dismissed") === "true"; } catch { return false; }
  });

  useEffect(() => {
    if (!orderId) return;
    fetchOrderById(orderId)
      .then((data) => {
        if (!data) { setError(true); setLoading(false); return; }
        setOrder(data);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [orderId]);

  // Realtime subscription
  useEffect(() => {
    if (!orderId) return;
    const unsub = subscribeToOrderStatus(orderId, (updated) => {
      setOrder((prev) => prev ? { ...prev, ...updated } : prev);
    });
    return unsub;
  }, [orderId]);

  // Auto-advance demo orders as fallback
  useEffect(() => {
    if (!order || !order.restaurant?.is_demo) return;
    if (order.status === "done") return;

    const createdAt = new Date(order.created_at).getTime();
    const schedule: { status: string; target: string; delayMs: number }[] = [
      { status: "new", target: "preparing", delayMs: 60000 },
      { status: "preparing", target: "ready", delayMs: 80000 },
      { status: "ready", target: "done", delayMs: 95000 },
    ];

    const current = schedule.find((s) => s.status === order.status);
    if (!current) return;

    const elapsed = Date.now() - createdAt;
    const remaining = Math.max(0, current.delayMs - elapsed);

    const timer = setTimeout(() => {
      advanceDemoOrder(order.id, current.target).catch(() => {});
    }, remaining);

    return () => clearTimeout(timer);
  }, [order?.status, order?.restaurant?.is_demo, order?.id, order?.created_at]);

  // Vibrate + confetti on ready
  useEffect(() => {
    if (!order || confettiFiredRef.current) return;
    if (order.status === "ready" || order.status === "done") {
      confettiFiredRef.current = true;
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if (confettiRef.current) launchConfetti(confettiRef.current);
    }
  }, [order?.status]);

  // Cleanup localStorage on done
  useEffect(() => {
    if (!order || order.status !== "done") return;
    const timer = setTimeout(() => {
      localStorage.removeItem("active-order");
    }, 30000);
    return () => clearTimeout(timer);
  }, [order?.status]);

  const primary = order?.restaurant?.primary_color || "#10B981";

  // Calculate progress
  const getEstimatedMinutes = useCallback(() => {
    if (!order) return 15;
    const items = Array.isArray(order.items) ? order.items : [];
    const itemCount = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
    const config = { default_minutes: 15, per_item_minutes: 2, max_minutes: 45 };
    return Math.min(config.default_minutes + itemCount * config.per_item_minutes, config.max_minutes);
  }, [order]);

  const estimatedMinutes = getEstimatedMinutes();
  const elapsedMs = order ? Date.now() - new Date(order.created_at).getTime() : 0;
  const elapsedMinutes = elapsedMs / 60000;
  const elapsedRatio = Math.min(elapsedMinutes / estimatedMinutes, 1);
  const remainingMinutes = Math.max(0, Math.ceil(estimatedMinutes - elapsedMinutes));

  const activeStepIndex = order ? getStepIndex(order.status, elapsedRatio) : 0;

  // Progress bar color
  const progressColor = elapsedRatio < 0.5 ? "#22C55E" : elapsedRatio < 0.8 ? "#F59E0B" : "#EF4444";
  const progressWidth = order?.status === "ready" || order?.status === "done" ? 100 : Math.max(5, elapsedRatio * 100);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">{t("suivi.loading")}</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 p-4">
        <p className="text-gray-500">{t("suivi.not_found")}</p>
        <button onClick={() => navigate("/")} className="text-sm underline text-gray-700">{t("suivi.back")}</button>
      </div>
    );
  }

  const isDone = order.status === "done";
  const isReady = order.status === "ready";
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: hexToRgba(primary, 0.04) }}>
      {/* Confetti canvas */}
      <canvas ref={confettiRef} className="fixed inset-0 z-50 pointer-events-none" />

      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(`/${order.restaurant.slug}`)} className="p-2 rounded-full bg-white/80 hover:bg-white transition-colors" aria-label={t("suivi.back_to_restaurant")}>
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{order.restaurant.name}</h1>
          <p className="text-sm text-gray-500">{t("suivi.order_number", { number: formatDisplayNumber(order) })}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-8">
        {/* Demo CTA banner */}
        {order.restaurant?.is_demo && (
          <div className="mb-6 flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-sm font-medium text-emerald-800">{t("demo.suivi_banner")}</p>
            <a
              href="/admin/demo?view=cuisine"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors flex-shrink-0"
            >
              {t("demo.suivi_cta")}
            </a>
          </div>
        )}

        {/* Auto-advance notice */}
        {order.restaurant?.is_demo && order.status !== "done" && order.status !== "ready" && (
          <p className="text-xs text-center text-muted-foreground mb-4">{t("demo.auto_advance")}</p>
        )}

        {/* Status headline */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isDone ? "done" : isReady ? "ready" : "tracking"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center mb-8"
          >
            {isDone ? (
              <>
                <p className="text-2xl font-bold text-gray-900">{t("suivi.done_title")}</p>
                <p className="text-sm text-gray-500 mt-1">{t("suivi.done_subtitle")}</p>
              </>
            ) : isReady ? (
              <>
                <motion.p
                  className="text-2xl font-bold"
                  style={{ color: primary }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.6, repeat: 2 }}
                >
                  {t("suivi.ready_title")}
                </motion.p>
                <p className="text-sm text-gray-500 mt-1">{t("suivi.ready_subtitle")}</p>
              </>
            ) : (
              <>
                {order.pickup_time ? (
                  <>
                    <p className="text-2xl font-bold text-gray-900">
                      {t("suivi.pickup_at", { time: new Date(order.pickup_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) })}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">{t("suivi.scheduled")}</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-900">{t("suivi.time_remaining", { minutes: remainingMinutes })}</p>
                    <p className="text-sm text-gray-500 mt-1">{ORDER_TYPE_KEYS[order.order_type] ? t(ORDER_TYPE_KEYS[order.order_type]) : order.order_type}</p>
                  </>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Progress bar */}
        {!isDone && (
          <div className="mb-8">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: isReady ? "#22C55E" : progressColor }}
                initial={{ width: 0 }}
                animate={{ width: `${progressWidth}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const isComplete = i <= activeStepIndex;
              const isActive = i === activeStepIndex;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex gap-4">
                  {/* Vertical line + circle */}
                  <div className="flex flex-col items-center">
                    <motion.div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: isComplete ? primary : "#F3F4F6",
                        color: isComplete ? "#fff" : "#9CA3AF",
                      }}
                      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                      transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
                    >
                      <Icon className="h-5 w-5" />
                    </motion.div>
                    {i < STEPS.length - 1 && (
                      <div
                        className="w-0.5 h-8 my-1"
                        style={{ backgroundColor: i < activeStepIndex ? primary : "#E5E7EB" }}
                      />
                    )}
                  </div>
                  {/* Label */}
                  <div className="pt-2">
                    <p className={`text-sm font-medium ${isComplete ? "text-gray-900" : "text-gray-400"}`}>
                      {t(step.label)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t("suivi.summary")}</h3>
          <div className="space-y-1.5">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.quantity || 1}x {item.name}</span>
                <span className="text-gray-900 font-medium">{Number(item.price || 0).toFixed(2)} €</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3">
            <div className="flex justify-between text-sm font-bold text-gray-900">
              <span>{t("suivi.total")}</span>
              <span>{Number(order.total).toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* Profile creation block */}
        {!isLoggedIn && order.customer_email && !profileDismissed && (isDone || isReady) && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-start gap-3 mb-3">
              <UserPlus className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: primary }} />
              <div>
                <p className="text-sm font-semibold text-gray-900">{t("suivi.create_profile")}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t("suivi.create_profile_desc")}</p>
              </div>
            </div>
            <div className="space-y-3">
              <Input
                type="email"
                value={order.customer_email}
                readOnly
                className="h-11 bg-gray-50 text-sm"
              />
              <Input
                type="password"
                placeholder={t("suivi.password_placeholder")}
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                className="h-11 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (signupPassword.length < 6) {
                      toast.error(t("suivi.password_too_short"));
                      return;
                    }
                    setSignupLoading(true);
                    try {
                      await signUp(
                        order.customer_email,
                        signupPassword,
                        order.customer_name,
                        order.customer_phone
                      );
                      toast.success(t("suivi.profile_created"));
                    } catch (e: any) {
                      toast.error(e.message || t("suivi.signup_error"));
                    } finally {
                      setSignupLoading(false);
                    }
                  }}
                  disabled={signupLoading || !signupPassword}
                  className="flex-1 h-11 text-sm"
                  style={{ backgroundColor: primary }}
                >
                  {signupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("suivi.create_button")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setProfileDismissed(true);
                    localStorage.setItem("cm_profile_dismissed", "true");
                  }}
                  className="h-11 text-sm"
                >
                  {t("suivi.no_thanks")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Contact restaurant */}
        {order.restaurant.phone && !isDone && (
          <a
            href={`tel:${order.restaurant.phone}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: hexToRgba(primary, 0.1), color: primary }}
          >
            <Phone className="h-4 w-4" />
            {t("suivi.call_restaurant")}
          </a>
        )}

        {/* Back button when done */}
        {isDone && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              localStorage.removeItem("active-order");
              navigate(`/${order.restaurant.slug}`);
            }}
            className="w-full py-3.5 rounded-xl text-white font-medium text-sm"
            style={{ backgroundColor: primary }}
          >
            {t("suivi.back_to_restaurant")}
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default SuiviPage;
