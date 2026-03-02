import { Check, Gift, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPricingPlans } from '@/services/subscription';
import type { SubscriptionPlan } from '@/types/onboarding';

interface PricingCardsProps {
  onSelect: (plan: SubscriptionPlan) => void;
  selected?: SubscriptionPlan;
}

export function PricingCards({ onSelect, selected }: PricingCardsProps) {
  const plans = getPricingPlans();

  return (
    <div className="space-y-6">
      {/* Trial reassurance banner */}
      <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 max-w-2xl mx-auto">
        <Gift className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-800">14 jours d'essai gratuit</p>
          <p className="text-xs text-green-700 mt-0.5">
            Testez sans engagement, vous ne serez debite qu'apres la periode d'essai.
          </p>
        </div>
      </div>

      {/* Plan cards: monthly left, annual right */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          const isAnnual = plan.id === 'annual';

          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-6 transition-all cursor-pointer ${
                isAnnual
                  ? isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5 scale-[1.02]'
                    : 'border-primary/40 bg-primary/5 hover:border-primary scale-[1.02]'
                  : isSelected
                    ? 'border-foreground ring-2 ring-foreground/20 bg-muted/30'
                    : 'border-border hover:border-foreground/30'
              }`}
              onClick={() => onSelect(plan.id as SubscriptionPlan)}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-4 bg-primary text-primary-foreground text-xs font-semibold px-3 py-0.5 rounded-full">
                  {plan.badge}
                </div>
              )}

              <h3 className="font-semibold text-foreground text-lg">{plan.name}</h3>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">
                  {plan.price.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-sm text-muted-foreground">
                  EUR/mois
                </span>
              </div>

              {isAnnual && plan.totalPrice && (
                <p className="text-xs text-muted-foreground mt-1">
                  (soit {plan.totalPrice.toFixed(2).replace('.', ',')} EUR/an)
                </p>
              )}

              <p className="text-xs mt-2">
                {isAnnual ? (
                  <span className="text-primary font-medium">Economisez 120 EUR/an</span>
                ) : (
                  <span className="text-muted-foreground">Sans engagement</span>
                )}
              </p>

              <Button
                variant={isAnnual ? 'default' : isSelected ? 'default' : 'outline'}
                className="w-full mt-5"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(plan.id as SubscriptionPlan);
                }}
              >
                {isSelected ? 'Selectionne' : 'Choisir cette formule'}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Features list */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground max-w-2xl mx-auto">
        <p className="font-medium text-foreground mb-1">Inclus dans votre abonnement :</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {plans[0].features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
              {feature}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs">
          14 jours d'essai gratuit, carte bancaire requise.
          Vos clients ne paient pas en ligne. Le paiement se fait sur place, comme d'habitude.
        </p>
      </div>

      {/* Security footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground max-w-2xl mx-auto">
        <Lock className="h-3.5 w-3.5" />
        <span>Paiement securise via Shopify. Aucun debit avant 14 jours.</span>
      </div>
    </div>
  );
}
