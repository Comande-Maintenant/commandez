import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPricingPlans } from '@/services/subscription';
import type { SubscriptionPlan } from '@/types/onboarding';

interface PricingCardsProps {
  onSelect: (plan: SubscriptionPlan) => void;
  selected?: SubscriptionPlan;
}

const BADGES: Record<string, string> = {
  'Flexible': '',
  'Populaire': 'bg-blue-100 text-blue-700',
  'Meilleur rapport': 'bg-green-100 text-green-700',
  'Premium': 'bg-purple-100 text-purple-700',
};

export function PricingCards({ onSelect, selected }: PricingCardsProps) {
  const plans = getPricingPlans();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-5 transition-all cursor-pointer ${
                isSelected
                  ? 'border-foreground ring-2 ring-foreground/20 bg-muted/30'
                  : 'border-border hover:border-foreground/30'
              }`}
              onClick={() => onSelect(plan.id)}
            >
              {plan.badge && (
                <span
                  className={`absolute -top-2.5 left-3 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    BADGES[plan.badge] || 'bg-muted text-muted-foreground'
                  }`}
                >
                  {plan.badge}
                </span>
              )}

              <h3 className="font-semibold text-foreground mt-1">{plan.name}</h3>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">
                  {plan.price.toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground">EUR/mois</span>
              </div>

              {plan.discount && (
                <span className="text-xs text-green-600 font-medium">{plan.discount}</span>
              )}

              <ul className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                variant={isSelected ? 'default' : 'outline'}
                className="w-full mt-4"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(plan.id);
                }}
              >
                {isSelected ? 'Selectionne' : 'Choisir'}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Inclus dans toutes les formules :</p>
        <ul className="space-y-1">
          <li>- Page en ligne personnalisee avec votre carte</li>
          <li>- QR code a poser sur vos tables</li>
          <li>- Prise de commande en temps reel</li>
          <li>- Tableau de bord pour gerer vos commandes</li>
        </ul>
        <p className="mt-3 text-xs">
          Vos clients ne paient pas en ligne. Le paiement se fait sur place, comme d'habitude.
        </p>
      </div>
    </div>
  );
}
