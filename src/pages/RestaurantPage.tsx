import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, MapPin, Clock, Phone, Shield, ShoppingBag, CreditCard, Banknote, Ticket, AlertCircle, Lock, Smartphone, Timer } from "lucide-react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchRestaurantBySlug, fetchMenuItems } from "@/lib/api";
import { checkRestaurantAvailability, canPlaceOrder } from "@/lib/schedule";
import type { DbRestaurant, DbMenuItem } from "@/types/database";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CartSheet } from "@/components/CartSheet";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSelector } from "@/components/restaurant/LanguageSelector";
import { CustomOrderBuilder } from "@/components/CustomOrderBuilder";
import { Skeleton } from "@/components/ui/skeleton";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { ProtectedPhone } from "@/components/ProtectedPhone";

const DEFAULT_PRIMARY = "#FF6B00";
const DEFAULT_BG = "#FFF8F0";

function parseHexToHSL(hex: string): { h: number; s: number; l: number } {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hexToHSL(hex: string): string {
  const { h, s, l } = parseHexToHSL(hex);
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function softenColor(hex: string): string {
  const { h, s, l } = parseHexToHSL(hex);
  const softS = s > 70 ? 60 : s;
  const softL = l < 35 ? 40 : l > 55 ? 50 : l;
  return hslToHex(h, softS, softL);
}

function lighten(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, Math.round(r + (255 - r) * amount));
  g = Math.min(255, Math.round(g + (255 - g) * amount));
  b = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function darken(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getDefaultCoverImage(cuisine: string): string {
  const c = cuisine.toLowerCase();
  if (c.includes("kebab") || c.includes("turc") || c.includes("döner") || c.includes("doner")) return "/images/covers/kebab.jpg";
  if (c.includes("pizza") || c.includes("italien") || c.includes("italian")) return "/images/covers/pizza.jpg";
  if (c.includes("burger") || c.includes("américain") || c.includes("american")) return "/images/covers/burger.jpg";
  return "/images/covers/default.jpg";
}

const PAYMENT_ICONS: Record<string, { icon: typeof CreditCard; label: string }> = {
  "CB": { icon: CreditCard, label: "reassurance.payment_card" },
  "Carte bancaire": { icon: CreditCard, label: "reassurance.payment_card" },
  "Especes": { icon: Banknote, label: "reassurance.payment_cash" },
  "Ticket restaurant": { icon: Ticket, label: "reassurance.payment_ticket" },
};

const RestaurantPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cartOpen, setCartOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const navScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const [scrolled, setScrolled] = useState(false);
  const heroSentinelRef = useRef<HTMLDivElement>(null);
  const { totalItems, subtotal } = useCart();
  const { t, tCategory, isRTL } = useLanguage();
  const { updateSection } = useVisitorTracking(restaurant?.id ?? null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchRestaurantBySlug(slug).then(async (r) => {
      setRestaurant(r);
      if (r) {
        const items = await fetchMenuItems(r.id);
        setMenuItems(items);
        document.title = `${r.name} - ${r.city || ""}`;
      }
      setLoading(false);
    });
  }, [slug]);

  // Check for active order in localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("active-order");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.restaurantSlug === slug && Date.now() - data.createdAt < 2 * 60 * 60 * 1000) {
        setActiveOrderId(data.orderId);
      } else if (Date.now() - data.createdAt >= 2 * 60 * 60 * 1000) {
        localStorage.removeItem("active-order");
      }
    } catch { /* ignore */ }
  }, [slug]);

  // IntersectionObserver: highlight active category on scroll
  useEffect(() => {
    if (loading || !restaurant || menuItems.length === 0) return;
    const sections = Object.entries(sectionRefs.current).filter(([, el]) => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cat = entry.target.getAttribute("data-category");
            if (cat) {
              setActiveCategory(cat);
              updateSection("category:" + cat);
            }
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    sections.forEach(([, el]) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [loading, restaurant, menuItems]);

  // Scroll sentinel: detect when hero is out of view
  useEffect(() => {
    const sentinel = heroSentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [loading, restaurant]);

  // Auto-scroll the tab bar to keep active tab visible
  useEffect(() => {
    if (!activeCategory) return;
    const tab = tabRefs.current[activeCategory];
    const nav = navScrollRef.current;
    if (!tab || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const scrollLeft = tab.offsetLeft - navRect.width / 2 + tabRect.width / 2;
    nav.scrollTo({ left: scrollLeft, behavior: "smooth" });
  }, [activeCategory]);

  const scrollToCategory = useCallback((cat: string) => {
    setActiveCategory(cat);
    isScrollingRef.current = true;
    sectionRefs.current[cat]?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Re-enable observer after scroll settles
    setTimeout(() => { isScrollingRef.current = false; }, 800);
  }, []);

  const primary = useMemo(() => softenColor(restaurant?.primary_color || DEFAULT_PRIMARY), [restaurant?.primary_color]);
  const bg = restaurant?.bg_color || DEFAULT_BG;
  const primaryLight = useMemo(() => lighten(primary, 0.85), [primary]);
  const primaryDark = useMemo(() => darken(primary, 0.15), [primary]);

  // Inject CSS custom properties
  const cssVars = useMemo(() => ({
    "--r-primary": primary,
    "--r-primary-hsl": hexToHSL(primary),
    "--r-primary-light": primaryLight,
    "--r-primary-dark": primaryDark,
    "--r-bg": bg,
  } as React.CSSProperties), [primary, primaryLight, primaryDark, bg]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-52 sm:h-64 w-full" />
        <div className="max-w-3xl mx-auto px-4 -mt-16 relative z-10 space-y-4">
          <Skeleton className="h-56 rounded-2xl" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Restaurant introuvable</h1>
          <Link to="/" className="text-muted-foreground hover:text-foreground mt-4 inline-block text-sm underline">
            {t("nav.back_home")}
          </Link>
        </div>
      </div>
    );
  }

  const categories = restaurant.categories ?? [];
  const currentCategory = activeCategory || categories[0];
  const catTranslations = restaurant.category_translations;
  const availability = checkRestaurantAvailability(restaurant);
  const orderCheck = canPlaceOrder(restaurant);
  const payments = restaurant.payment_methods ?? [];

  const activeCategories = categories.filter((cat) =>
    cat === "Personnalisation" && restaurant.customization_config?.enabled
      ? true
      : menuItems.some((m) => m.category === cat)
  );

  const initial = restaurant.name?.charAt(0)?.toUpperCase() || "R";

  return (
    <div className="min-h-screen pb-28" dir={isRTL ? "rtl" : "ltr"} style={{ ...cssVars, backgroundColor: bg }}>
      {/* Cover / Hero */}
      <div className="relative h-[220px] sm:h-64 overflow-hidden">
        <img
          src={restaurant.cover_image || getDefaultCoverImage(restaurant.cuisine)}
          alt={restaurant.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 50%, ${hexToRgba(primary, 0.85)} 100%)`
          }}
        />
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <Link to="/" className="p-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors">
            <ArrowLeft className="h-5 w-5 text-white" />
          </Link>
          <LanguageSelector />
        </div>
        {/* Scroll sentinel */}
        <div ref={heroSentinelRef} className="absolute bottom-0 h-1 w-full" />
      </div>

      {/* Mirror gradient background: primary fades to bg behind content */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: "180px",
          height: "400px",
          background: `linear-gradient(to bottom, ${hexToRgba(primary, 0.15)} 0%, ${hexToRgba(primary, 0.05)} 40%, ${bg} 100%)`,
          zIndex: 0,
        }}
      />

      <div className="max-w-3xl mx-auto px-4 -mt-16 relative z-10">
        {/* Restaurant Info Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div
            className="bg-white rounded-2xl p-5 border border-gray-100 transition-shadow duration-300"
            style={{ boxShadow: scrolled ? "0 10px 40px rgba(0,0,0,0.12)" : "0 4px 12px rgba(0,0,0,0.06)" }}
          >
            {/* Logo + Name + Status */}
            <div className="flex items-start gap-4">
              {restaurant.image ? (
                <img
                  src={restaurant.image}
                  alt={restaurant.name}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border-2"
                  style={{ borderColor: primary }}
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-2xl font-bold"
                  style={{ backgroundColor: primary }}
                >
                  {initial}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{restaurant.name}</h1>
                  {availability.isOpen ? (
                    <span className="text-xs font-semibold text-white px-2.5 py-1 rounded-full whitespace-nowrap bg-emerald-500">
                      {t("status.open")}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-white px-2.5 py-1 rounded-full whitespace-nowrap bg-red-500">
                      {t("status.closed")}
                    </span>
                  )}
                </div>
                {restaurant.cuisine && (
                  <p className="text-sm text-gray-500 mt-0.5">{restaurant.cuisine}</p>
                )}
                {(restaurant.rating > 0) && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-semibold text-gray-900">{restaurant.rating}</span>
                    {restaurant.review_count > 0 && (
                      <span className="text-sm text-gray-500">({t("info.reviews", { count: restaurant.review_count })})</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {restaurant.description && (
              <p className="text-sm text-gray-600 mt-3">{restaurant.description}</p>
            )}

            {/* Info: address, phone, hours */}
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              {(restaurant.address || restaurant.city) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: primary }} />
                  <span>{[restaurant.address, restaurant.city].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {restaurant.restaurant_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 flex-shrink-0" style={{ color: primary }} />
                  <ProtectedPhone
                    phone={restaurant.restaurant_phone}
                    style={{ color: primary }}
                  />
                </div>
              )}
              {restaurant.hours && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 flex-shrink-0" style={{ color: primary }} />
                  <span>{restaurant.hours}</span>
                </div>
              )}
            </div>

            {/* Payment methods */}
            {payments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {payments.map((method) => {
                  const config = PAYMENT_ICONS[method];
                  const Icon = config?.icon || CreditCard;
                  return (
                    <span
                      key={method}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full"
                      style={{ backgroundColor: primaryLight, color: primaryDark }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {config ? t(config.label) : method}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Reassurance block */}
            <motion.div
              className="mt-4 p-3.5 rounded-xl flex items-start gap-3"
              style={{ backgroundColor: primaryLight }}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3 }}
            >
              <Shield className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: primary }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: primaryDark }}>{t("reassurance.title")}</p>
                <p className="text-xs mt-0.5" style={{ color: primary }}>{t("reassurance.subtitle")}</p>
              </div>
            </motion.div>

            {/* Closed / not accepting banner */}
            {!orderCheck.canOrder && (
              <div className="mt-3 p-3 bg-red-50 rounded-xl flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{orderCheck.reason}</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Active order banner */}
        {activeOrderId && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate(`/suivi/${activeOrderId}`)}
            className="w-full mt-4 flex items-center justify-between px-4 py-3 rounded-xl text-white text-sm font-medium"
            style={{ backgroundColor: primary }}
          >
            <span>Votre commande est en cours</span>
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs">Suivre</span>
          </motion.button>
        )}

        {/* No menu items edge case */}
        {menuItems.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-sm">{t("menu.empty")}</p>
          </div>
        ) : (
          <>
            {/* Category Tabs - sticky */}
            {activeCategories.length > 0 && (
              <div
                className={`sticky top-0 z-30 mt-4 -mx-4 px-4 py-3 border-b border-gray-200/50 backdrop-blur-xl transition-shadow duration-300 ${scrolled ? "shadow-md" : ""}`}
                style={{ backgroundColor: `${bg}ee` }}
              >
                <div ref={navScrollRef} className="flex gap-2 overflow-x-auto no-scrollbar">
                  {activeCategories.map((cat) => (
                    <button
                      key={cat}
                      ref={(el) => { tabRefs.current[cat] = el; }}
                      onClick={() => scrollToCategory(cat)}
                      className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[44px]"
                      style={
                        currentCategory === cat
                          ? { backgroundColor: primary, color: "#ffffff" }
                          : { backgroundColor: primaryLight, color: primaryDark }
                      }
                    >
                      {tCategory(cat, catTranslations)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Menu Sections */}
            <div className="mt-6 space-y-8">
              {activeCategories.map((cat) => {
                // Personnalisation category: render the custom order builder
                if (cat === "Personnalisation" && restaurant.customization_config?.enabled) {
                  return (
                    <div key={cat} ref={(el) => { sectionRefs.current[cat] = el; }} data-category={cat} className="scroll-mt-20">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{tCategory(cat, catTranslations)}</h3>
                      <CustomOrderBuilder
                        config={restaurant.customization_config}
                        restaurantSlug={restaurant.slug}
                        restaurantId={restaurant.id}
                        primaryColor={primary}
                        primaryLight={primaryLight}
                        primaryDark={primaryDark}
                      />
                    </div>
                  );
                }

                const catItems = menuItems.filter((m) => m.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat} ref={(el) => { sectionRefs.current[cat] = el; }} data-category={cat} className="scroll-mt-20">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{tCategory(cat, catTranslations)}</h3>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={cat}
                        className="space-y-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {catItems.map((item, idx) => (
                          <MenuItemCard
                            key={item.id}
                            item={item}
                            index={idx}
                            restaurantSlug={restaurant.slug}
                            restaurantId={restaurant.id}
                            primaryColor={primary}
                            primaryLight={primaryLight}
                            isEven={idx % 2 === 0}
                          />
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* How it works section */}
        <motion.div
          className="mt-12 bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-5">{t("how.title")}</h3>
          <div className="space-y-4">
            {[
              { num: "1", text: t("how.step1") },
              { num: "2", text: t("how.step2") },
              { num: "3", text: t("how.step3") },
            ].map((step) => (
              <div key={step.num} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                  style={{ backgroundColor: primary }}
                >
                  {step.num}
                </div>
                <p className="text-sm text-gray-700 pt-1.5">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" style={{ color: primary }} />
              {t("how.no_online_payment")}
            </span>
            <span className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" style={{ color: primary }} />
              {t("how.realtime_tracking")}
            </span>
            <span className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" style={{ color: primary }} />
              {t("how.order_from_phone")}
            </span>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="mt-8 mb-4 text-center">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            {t("footer.powered_by")}
          </Link>
        </div>
      </div>

      {/* Floating cart bar */}
      <AnimatePresence>
        {totalItems > 0 && orderCheck.canOrder && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2"
            style={{ background: `linear-gradient(to top, ${bg} 60%, transparent)` }}
          >
            <div className="max-w-3xl mx-auto">
              <button
                onClick={() => setCartOpen(true)}
                className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white shadow-2xl transition-transform active:scale-[0.98]"
                style={{ backgroundColor: primary }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <ShoppingBag className="h-5 w-5" />
                    <span className="absolute -top-2 -right-2 bg-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center" style={{ color: primary }}>
                      {totalItems}
                    </span>
                  </div>
                  <span className="font-medium text-sm">{t("cart.view")}</span>
                </div>
                <span className="font-bold text-base">{subtotal.toFixed(2)} €</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart sheet (hidden trigger, opened programmatically) */}
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </div>
  );
};

export default RestaurantPage;
