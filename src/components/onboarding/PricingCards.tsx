import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPricingPlans } from '@/services/subscription';
import type { SubscriptionPlan } from '@/types/onboarding';

interface PricingCardsProps {
  onSelect: (plan: SubscriptionPlan) => void;
  selected?: SubscriptionPlan;
}

export function PricingCards({ onSelect, selected }: PricingCardsProps) {
  const plan = getPricingPlans()[0];
  const isSelected = selected === plan.id;

  return (
    <div className="space-y-6">
      <div
        className={`relative rounded-xl border p-6 transition-all cursor-pointer max-w-md mx-auto ${
          isSelected
            ? 'border-foreground ring-2 ring-foreground/20 bg-muted/30'
            : 'border-border hover:border-foreground/30'
        }`}
        onClick={() => onSelect(plan.id)}
      >
        <h3 className="font-semibold text-foreground text-lg">{plan.name}</h3>

        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-4xl font-bold text-foreground">
            {plan.price.toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground">EUR / 4 semaines</span>
        </div>

        <p className="text-xs text-muted-foreground mt-1">
          Sans engagement, resiliable a tout moment
        </p>

        <ul className="mt-5 space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              {feature}
            </li>
          ))}
        </ul>

        <Button
          variant={isSelected ? 'default' : 'outline'}
          className="w-full mt-5"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(plan.id);
          }}
        >
          {isSelected ? 'Selectionne' : 'Choisir cette formule'}
        </Button>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground max-w-md mx-auto">
        <p className="font-medium text-foreground mb-1">Inclus dans votre abonnement :</p>
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
