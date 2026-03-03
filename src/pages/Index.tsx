import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  // Auto-redirect if restaurateur is already logged in
  useEffect(() => {
    document.title = "commandeici - Espace restaurateur";

    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("slug")
          .eq("owner_id", data.user.id)
          .limit(1);

        if (restaurants && restaurants.length > 0) {
          navigate(`/admin/${restaurants[0].slug}`, { replace: true });
          return;
        }
      }
      setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <a href="https://commandeici.com" className="font-semibold text-lg text-foreground hover:opacity-80">
            commande<span className="text-muted-foreground">ici</span>
          </a>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          className="w-full max-w-sm text-center space-y-6 py-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">Espace restaurateur</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Gérez vos commandes, votre carte et vos clients.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => navigate("/connexion")}
              className="w-full h-12 rounded-xl text-base font-semibold"
            >
              Se connecter
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/inscription")}
              className="w-full h-12 rounded-xl text-base"
            >
              Creer ma page gratuitement
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/admin/demo")}
              className="w-full h-10 rounded-xl text-sm text-muted-foreground hover:text-foreground"
            >
              Decouvrir en mode demo &rarr;
            </Button>
          </div>

          <div className="space-y-2 pt-2">
            <a
              href="mailto:contact@commandeici.com"
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              contact@commandeici.com
            </a>
            <a
              href="https://commandeici.com"
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Retour au site
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
