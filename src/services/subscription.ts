import type { SubscriptionPlan, PricingPlan } from '@/types/onboarding';

export function getPricingPlans(): PricingPlan[] {
  return [
    {
      id: 'monthly',
      name: 'Tout inclus',
      price: 19.99,
      features: [
        'Page en ligne personnalisee',
        'QR code pour vos tables',
        'Prise de commande en temps reel',
        'Tableau de bord complet',
        'Traduction auto en 12 langues',
        'Statistiques avancees',
        'Analyse OCR de votre carte',
        'Support prioritaire',
      ],
    },
  ];
}

// Placeholder - simulates a successful checkout
export async function createCheckoutSession(_plan: SubscriptionPlan): Promise<string> {
  // In production, this would call a Stripe Edge Function
  return 'success';
}
