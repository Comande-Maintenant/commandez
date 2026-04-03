import type { SubscriptionPlan, PricingPlan } from '@/types/onboarding';

export function getPricingPlans(t: (key: string, params?: Record<string, string | number>) => string): PricingPlan[] {
  const features = [
    t('subscription.features.custom_page'),
    t('subscription.features.custom_qr'),
    t('subscription.features.pos_realtime'),
    t('subscription.features.full_dashboard'),
    t('subscription.features.auto_translation'),
    t('subscription.features.advanced_stats'),
    t('subscription.features.ocr_menu'),
    t('subscription.features.priority_support'),
  ];

  return [
    {
      id: 'monthly',
      name: t('subscription.monthly'),
      price: 29.99,
      features,
    },
  ];
}

// No longer used directly - checkout goes through Stripe edge function
export async function createCheckoutSession(_plan: SubscriptionPlan): Promise<string> {
  return 'success';
}
