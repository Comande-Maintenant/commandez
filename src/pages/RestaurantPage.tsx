import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Star, MapPin, Clock, Info } from "lucide-react";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { getRestaurantBySlug } from "@/data/mockData";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CartSheet } from "@/components/CartSheet";
import { useCart } from "@/context/CartContext";

const RestaurantPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const restaurant = getRestaurantBySlug(slug || "");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { totalItems } = useCart();

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Restaurant introuvable</h1>
          <Link to="/" className="text-muted-foreground hover:text-foreground mt-4 inline-block text-sm underline">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  const currentCategory = activeCategory || restaurant.categories[0];

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    sectionRefs.current[cat]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Cover */}
      <div className="relative h-48 sm:h-64 overflow-hidden">
        <img
          src={restaurant.coverImage}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

        {/* Nav */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <Link
            to="/"
            className="p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <CartSheet />
        </div>
      </div>

      {/* Restaurant Info */}
      <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{restaurant.name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{restaurant.cuisine}</p>
              </div>
              {restaurant.isOpen ? (
                <span className="text-xs font-semibold bg-foreground text-primary-foreground px-2.5 py-1 rounded-full">
                  Ouvert
                </span>
              ) : (
                <span className="text-xs font-semibold bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                  Fermé
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-3">{restaurant.description}</p>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-foreground text-foreground" />
                <span className="font-semibold text-foreground">{restaurant.rating}</span>
                ({restaurant.reviewCount} avis)
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {restaurant.estimatedTime}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {restaurant.address}, {restaurant.city}
              </span>
            </div>

            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              <span>Horaires : {restaurant.hours} · Livraison {restaurant.deliveryFee.toFixed(2)} € · Min. {restaurant.minimumOrder} €</span>
            </div>
          </div>
        </motion.div>

        {/* Category Tabs */}
        <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl mt-6 -mx-4 px-4 py-3 border-b border-border">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {restaurant.categories.map((cat) => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  currentCategory === cat
                    ? "bg-foreground text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Sections */}
        <div className="mt-6 space-y-8">
          {restaurant.categories.map((cat) => {
            const catItems = restaurant.menu.filter((m) => m.category === cat);
            if (catItems.length === 0) return null;
            return (
              <div
                key={cat}
                ref={(el) => { sectionRefs.current[cat] = el; }}
                className="scroll-mt-20"
              >
                <h3 className="text-lg font-semibold text-foreground mb-3">{cat}</h3>
                <div className="space-y-1">
                  {catItems.map((item) => (
                    <MenuItemCard key={item.id} item={item} restaurantSlug={restaurant.slug} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Cart Bar */}
      {totalItems > 0 && (
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
