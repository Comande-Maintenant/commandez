import { restaurantDocument } from '../../supabase/functions/_shared/restaurant-document';
import type { DbRestaurant, DbMenuItem } from '@/types/database';

// Use the same document contract on direct requests and SPA navigation. Public
// canonical URLs must also stay HTTPS when displayed inside the iOS WebView.
export function setRestaurantHead(restaurant: DbRestaurant, items: DbMenuItem[], kiosk: boolean) {
  const demo = !!restaurant.is_demo;
  const prospect = restaurant.account_status === 'prospect';
  const publicRestaurant = {
    name: restaurant.name, slug: restaurant.slug,
    city: restaurant.city || undefined, address: restaurant.address || undefined,
    description: restaurant.description || undefined,
    restaurant_phone: restaurant.restaurant_phone || undefined,
    image: restaurant.image || restaurant.cover_image || undefined,
    hours: restaurant.hours || undefined,
    is_demo: demo || prospect,
  };
  const content = restaurantDocument(publicRestaurant, items.map(item => ({
    name: item.name, category: item.category || '',
    description: item.description || undefined, price: item.price,
  })));
  document.head.querySelectorAll('title, meta[name="description"], meta[name="robots"], meta[name^="twitter:"], meta[property^="og:"], link[rel="canonical"], #restaurant-public-schema, #demo-ld-json')
    .forEach(element => element.remove());
  const template = document.createElement('template');
  template.innerHTML = content.head;
  document.head.appendChild(template.content);
  if (kiosk) document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, nofollow');
  if (demo) {
    document.title = 'Demonstration - Application de commande en ligne pour restaurants | commandeici';
    const schema = document.createElement('script');
    schema.id = 'demo-ld-json';
    schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'commandeici', applicationCategory: 'BusinessApplication', url: 'https://commandeici.com' });
    document.head.appendChild(schema);
  }
}
