import type { SubscriptionPlan, PricingPlan } from '@/types/onboarding';

export function getPricingPlans(): PricingPlan[] {
  return [
    {
      id: 'monthly',
      name: 'Sans engagement',
      price: 19.99,
      badge: 'Flexible',
      features: [
        'Page en ligne personnalisee',
        'QR code pour vos tables',
        'Prise de commande en temps reel',
        'Tableau de bord complet',
        'Support par email',
      ],
    },
    {
      id: '6months',
      name: '6 mois',
      price: 16.99,
      discount: '-15%',
      badge: 'Populaire',
      features: [
        'Tout du plan mensuel',
        'Traduction auto en 12 langues',
        'Statistiques avancees',
        'Support prioritaire',
      ],
    },
    {
      id: '12months',
      name: '12 mois',
      price: 14.99,
      discount: '-25%',
      badge: 'Meilleur rapport',
      features: [
        'Tout du plan 6 mois',
        'Analyse OCR de votre carte',
        'Extraction automatique des couleurs',
        'Accompagnement personnalise',
      ],
    },
    {
      id: '18months',
      name: '18 mois',
      price: 12.99,
      discount: '-35%',
      badge: 'Premium',
      features: [
        'Tout du plan 12 mois',
        'Livraison integree',
        'Multi-etablissements',
        'API personnalisee',
      ],
    },
  ];
}

// Placeholder - simulates a successful checkout
export async function createCheckoutSession(_plan: SubscriptionPlan): Promise<string> {
  // In production, this would call a Stripe Edge Function
  return 'success';
}
