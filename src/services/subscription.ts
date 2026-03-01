import type { SubscriptionPlan, PricingPlan } from '@/types/onboarding';

export function getPricingPlans(): PricingPlan[] {
  return [
    {
      id: 'monthly',
      name: 'Mensuel',
      price: 29.99,
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
    {
      id: 'annual',
      name: 'Annuel',
      price: 239.88,
      badge: 'Economisez 33%',
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

// No longer used directly - checkout goes through Shopify
export async function createCheckoutSession(_plan: SubscriptionPlan): Promise<string> {
  return 'success';
}
