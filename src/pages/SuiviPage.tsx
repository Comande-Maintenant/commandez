import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Inbox, ChefHat, Timer, CheckCircle, Phone, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchOrderById, subscribeToOrderStatus } from "@/lib/api";
import type { DbOrder } from "@/types/database";

type OrderStatus = DbOrder["status"];

interface StepDef {
  key: string;
  label: string;
  icon: typeof Inbox;
  matchStatuses: OrderStatus[];
}

const STEPS: StepDef[] = [
  { key: "received", label: "Commande recue", icon: Inbox, matchStatuses: ["new", "preparing", "ready", "done"] },
  { key: "preparing", label: "En preparation", icon: ChefHat, matchStatuses: ["preparing", "ready", "done"] },
  { key: "almost", label: "Bientot prete", icon: Timer, matchStatuses: ["ready", "done"] },
  { key: "ready", label: "Prete !", icon: CheckCircle, matchStatuses: ["ready", "done"] },
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

  const colors = ["#FF6B00", "#22C55E", "#3B82F6", "#EAB308", "#EC4899", "#8B5CF6"];
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

const ORDER_TYPE_LABELS: Record<string, string> = {
  collect: "A emporter",
  delivery: "Livraison",
  dine_in: "Sur place",
};

const SuiviPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<(DbOrder & { restaurant: { name: string; slug: string; primary_color: string; phone: string } }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const confettiFiredRef = useRef(false);

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

  const primary = order?.restaurant?.primary_color || "#FF6B00";

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
        <div className="animate-pulse text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 p-4">
        <p className="text-gray-500">Commande introuvable</p>
        <button onClick={() => navigate("/")} className="text-sm underline text-gray-700">Retour</button>
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
        <button onClick={() => navigate(`/${order.restaurant.slug}`)} className="p-2 rounded-full bg-white/80 hover:bg-white transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{order.restaurant.name}</h1>
          <p className="text-sm text-gray-500">Commande #{order.order_number}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-8">
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
                <p className="text-2xl font-bold text-gray-900">Merci et bon appetit !</p>
                <p className="text-sm text-gray-500 mt-1">Votre commande est terminee</p>
              </>
            ) : isReady ? (
              <>
                <motion.p
                  className="text-2xl font-bold"
                  style={{ color: primary }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.6, repeat: 2 }}
                >
                  Votre commande est prete !
                </motion.p>
                <p className="text-sm text-gray-500 mt-1">Vous pouvez venir la recuperer</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">Environ {remainingMinutes} min</p>
                <p className="text-sm text-gray-500 mt-1">{ORDER_TYPE_LABELS[order.order_type] || order.order_type}</p>
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
                      {step.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Recapitulatif</h3>
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
              <span>Total</span>
              <span>{Number(order.total).toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* Contact restaurant */}
        {order.restaurant.phone && !isDone && (
          <a
            href={`tel:${order.restaurant.phone}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: hexToRgba(primary, 0.1), color: primary }}
          >
            <Phone className="h-4 w-4" />
            Appeler le restaurant
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
            Retour au restaurant
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default SuiviPage;
