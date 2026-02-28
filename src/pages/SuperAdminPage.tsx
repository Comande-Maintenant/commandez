import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchOwner } from "@/lib/api";
import { PlatformStats } from "@/components/super-admin/PlatformStats";
import { RestaurantList } from "@/components/super-admin/RestaurantList";
import { RestaurantDetail } from "@/components/super-admin/RestaurantDetail";
import { PlatformAlerts } from "@/components/super-admin/PlatformAlerts";

const SuperAdminPage = () => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const owner = await fetchOwner(user.id);
      if (owner?.role === "super_admin") {
        setAuthorized(true);
      }
    } catch {
      // Not authorized
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Acces refuse</h1>
          <p className="text-muted-foreground mb-4">Cette page est reservee aux super administrateurs.</p>
          <Link to="/" className="text-sm text-foreground underline">Retour</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/50">
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-foreground" />
            <h1 className="text-base font-semibold text-foreground">Super Admin</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {selectedRestaurant ? (
          <RestaurantDetail
            restaurant={selectedRestaurant}
            onBack={() => setSelectedRestaurant(null)}
          />
        ) : (
          <>
            <PlatformStats />
            <PlatformAlerts />
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Tous les restaurants</h2>
              <RestaurantList onSelect={setSelectedRestaurant} />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default SuperAdminPage;
