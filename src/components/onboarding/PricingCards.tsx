import { isNative } from '@/lib/native';
import { Check, Gift, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPricingPlans } from '@/services/subscription';
import { useLanguage } from '@/context/LanguageContext';
import type { SubscriptionPlan } from '@/types/onboarding';

interface PricingCardsProps {
  onSelect: (plan: SubscriptionPlan) => void;
  selected?: SubscriptionPlan;
  disabled?: boolean;
}

export function PricingCards({ onSelect, selected, disabled }: PricingCardsProps) {
  const { t } = useLanguage();
  const plans = getPricingPlans(t);
  const plan = plans[0];

  if (isNative()) return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
        <Gift className="h-7 w-7 text-primary mx-auto mb-3" aria-hidden="true" />
        <h3 className="font-semibold text-foreground text-lg">{t('native.free.title')}</h3>
        <p className="text-sm text-muted-foreground mt-2">{t('native.free.description')}</p>
        <Button disabled={disabled} className="w-full mt-5 min-h-12" onClick={() => onSelect('none')}>
          {t('native.free.publish')}
        </Button>
      </div>
      <div className="rounded-lg bg-muted/50 p-4 text-sm">
        <p className="font-medium mb-2">{t('subscription.included')}</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
          {plan.features.map(feature => <li key={feature} className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />{feature}</li>)}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Launch offer banner */}
      <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 max-w-2xl mx-auto">
        <Gift className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-800">{t('commerce.free_title')}</p>
          <p className="text-xs text-green-700 mt-0.5">
            {t('commerce.free_desc')}
          </p>
        </div>
      </div>

      {/* Single plan card */}
      <div className="max-w-md mx-auto">
        <div
          className={`relative rounded-xl border-2 p-6 transition-all cursor-pointer text-center ${
            selected === 'monthly'
              ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
              : 'border-primary/40 bg-primary/5 hover:border-primary'
          }`}
        >
          <h3 className="font-semibold text-foreground text-lg">{plan.name}</h3>

          <div className="mt-3 flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-primary">0 €</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{t('commerce.free_desc')}</p>

          <Button disabled={disabled}
            className="w-full mt-5"
            onClick={(e) => {
              e.stopPropagation();
              onSelect('monthly');
            }}
          >
            {t('commerce.publish')}
          </Button>
        </div>
      </div>

      {/* Features list */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground max-w-2xl mx-auto">
        <p className="font-medium text-foreground mb-1">{t('subscription.included')}</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
              {feature}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs">
          {t('commerce.free_future')}
        </p>
      </div>

      {/* Security footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground max-w-2xl mx-auto">
        <Lock className="h-3.5 w-3.5" />
        <span>{t('commerce.free_desc')}</span>
      </div>
    </div>
  );
}
