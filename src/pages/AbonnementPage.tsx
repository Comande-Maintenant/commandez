import { Link } from "react-router-dom";
import { ArrowLeft, Check, Shield, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRANDING } from "@/config/branding";

const features = [
  "Page de commande personnalisee",
  "Menu modifiable en temps reel",
  "0% de commission sur les commandes",
  "Dashboard et statistiques",
  "Base clients avec historique",
  "Notifications en temps reel",
  "QR Code aux couleurs de votre resto",
  "Lien pour fiche Google et reseaux",
  "Mode vacances, horaires flexibles",
  "Support reactif",
];

const AbonnementPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-80">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-semibold text-lg">commandeici</span>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        {/* Trial expired message */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 text-center">
          <Clock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Votre essai est termine</h2>
          <p className="text-sm text-muted-foreground">
            Pour continuer a recevoir des commandes, activez votre abonnement.
          </p>
        </div>

        {/* Pricing card */}
        <div className="bg-card border-2 border-primary rounded-2xl p-8 text-center relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
            Tout inclus
          </div>

          <h3 className="text-xl font-bold text-foreground mb-1">commandeici Pro</h3>
          <div className="flex items-baseline justify-center gap-1 mb-1">
            <span className="text-4xl font-bold text-foreground">19&euro;</span>
            <span className="text-muted-foreground">/mois</span>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Sans engagement</p>

          <ul className="text-left space-y-2.5 mb-8">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          <Button className="w-full h-12 rounded-xl text-base" asChild>
            <a href={`mailto:${BRANDING.contactEmail}?subject=Activation abonnement commandeici`}>
              Activer mon abonnement
            </a>
          </Button>

          <p className="text-xs text-muted-foreground mt-3">
            Contactez-nous pour activer votre abonnement. Paiement par virement ou carte.
          </p>
        </div>

        {/* Reassurance */}
        <div className="mt-8 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
            <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Sans engagement</p>
              <p className="text-xs text-muted-foreground">Arretez quand vous voulez, en un clic.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
            <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Rentabilise des la 2e commande directe</p>
              <p className="text-xs text-muted-foreground">19 euros/mois vs 30% de commission par commande sur les plateformes.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AbonnementPage;
