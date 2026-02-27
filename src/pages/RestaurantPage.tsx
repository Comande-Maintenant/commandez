import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Star, MapPin, Clock, Info, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { fetchRestaurantBySlug, fetchMenuItems } from "@/lib/api";
import { checkRestaurantAvailability, canPlaceOrder } from "@/lib/schedule";
import type { DbRestaurant, DbMenuItem } from "@/types/database";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CartSheet } from "@/components/CartSheet";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSelector } from "@/components/restaurant/LanguageSelector";
import { Skeleton } from "@/components/ui/skeleton";

const RestaurantPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { totalItems } = useCart();
  const { t, tCategory, isRTL } = useLanguage();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchRestaurantBySlug(slug).then(async (r) => {
      setRestaurant(r);
      if (r) {
        const items = await fetchMenuItems(r.id);
        setMenuItems(items);
        document.title = `${r.name} - ${r.city}`;
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-48 sm:h-64 w-full" />
        <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10 space-y-4">
          <Skeleton className="h-48 rounded-2xl" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
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

  // Filter categories that have enabled items
  const activeCategories = categories.filter((cat) =>
    menuItems.some((m) => m.category === cat)
  );

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    sectionRefs.current[cat]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir={isRTL ? "rtl" : "ltr"}>
      {/* Cover */}
      <div className="relative h-48 sm:h-64 overflow-hidden">
        {restaurant.cover_image ? (
          <img src={restaurant.cover_image} alt={restaurant.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-secondary" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <Link to="/" className="p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <CartSheet />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{restaurant.name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{restaurant.cuisine}</p>
              </div>
              {availability.isOpen ? (
                <span className="text-xs font-semibold bg-foreground text-primary-foreground px-2.5 py-1 rounded-full whitespace-nowrap">{t("status.open")}</span>
              ) : (
                <span className="text-xs font-semibold bg-muted text-muted-foreground px-2.5 py-1 rounded-full whitespace-nowrap">{t("status.closed")}</span>
              )}
            </div>
            {restaurant.description && (
              <p className="text-sm text-muted-foreground mt-3">{restaurant.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-foreground text-foreground" />
                <span className="font-semibold text-foreground">{restaurant.rating}</span>
                ({t("info.reviews", { count: restaurant.review_count })})
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />{restaurant.estimated_time}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /><span className="truncate">{restaurant.address}, {restaurant.city}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{t("info.hours")} : {restaurant.hours} · {t("info.delivery_fee", { fee: Number(restaurant.delivery_fee).toFixed(2) })} · {t("info.minimum_order", { min: Number(restaurant.minimum_order) })}</span>
            </div>

            {/* Closed / not accepting banner */}
            {!orderCheck.canOrder && (
              <div className="mt-3 p-3 bg-destructive/10 rounded-xl flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{orderCheck.reason}</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* No menu items edge case */}
        {menuItems.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">La carte est en cours de creation. Revenez bientot !</p>
          </div>
        ) : (
          <>
            {/* Category Tabs */}
            {activeCategories.length > 0 && (
              <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl mt-6 -mx-4 px-4 py-3 border-b border-border">
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {activeCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => scrollToCategory(cat)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[44px] ${
                        currentCategory === cat
                          ? "bg-foreground text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
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
                const catItems = menuItems.filter((m) => m.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat} ref={(el) => { sectionRefs.current[cat] = el; }} className="scroll-mt-20">
                    <h3 className="text-lg font-semibold text-foreground mb-3">{tCategory(cat, catTranslations)}</h3>
                    <div className="space-y-1">
                      {catItems.map((item) => (
                        <MenuItemCard key={item.id} item={item} restaurantSlug={restaurant.slug} restaurantId={restaurant.id} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {totalItems > 0 && orderCheck.canOrder && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-background/90 backdrop-blur-xl border-t border-border"
        >
          <div className="max-w-3xl mx-auto">
            <CartSheet />
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default RestaurantPage;
