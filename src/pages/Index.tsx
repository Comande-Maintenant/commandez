import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Star, Clock, ChevronRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { fetchRestaurants } from "@/lib/api";
import type { DbRestaurant } from "@/types/database";
import { Input } from "@/components/ui/input";

const Index = () => {
  const [search, setSearch] = useState("");
  const [restaurants, setRestaurants] = useState<DbRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "resto.order – Commande en ligne pour restaurants";
    fetchRestaurants().then((data) => {
      setRestaurants(data);
      setLoading(false);
    });
  }, []);

  const filtered = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.city.toLowerCase().includes(search.toLowerCase()) ||
      r.cuisine.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            resto<span className="text-muted-foreground">.order</span>
          </h1>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 pt-12 pb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
            Commandez chez votre<br />
            <span className="text-muted-foreground">resto préféré.</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Kebab, tacos, burger — en 3 clics, sans commission.
          </p>
        </motion.div>

        <motion.div className="mt-8 relative" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Rechercher un restaurant, une ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-14 text-base rounded-2xl bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-foreground/20"
          />
        </motion.div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-20">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((restaurant, index) => (
              <motion.div key={restaurant.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 * index }}>
                <Link to={`/${restaurant.slug}`} className="block group">
                  <div className="flex gap-4 p-4 rounded-2xl bg-card hover:bg-secondary/50 transition-colors duration-200">
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      {!restaurant.is_open && (
                        <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary-foreground bg-foreground/80 px-2 py-1 rounded-full">Fermé</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground text-lg leading-tight">{restaurant.name}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">{restaurant.cuisine}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors flex-shrink-0 mt-1" />
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
                          <span className="font-medium text-foreground">{restaurant.rating}</span>
                          <span>({restaurant.review_count})</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />{restaurant.estimated_time}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{restaurant.city}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">Aucun restaurant trouvé</p>
                <p className="text-muted-foreground/60 text-sm mt-1">Essayez un autre terme de recherche</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default Index;
