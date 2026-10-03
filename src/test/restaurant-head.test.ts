import { beforeEach, describe, expect, it } from 'vitest';
import { setRestaurantHead } from '@/lib/restaurant-head';
import type { DbRestaurant, DbMenuItem } from '@/types/database';
const restaurant = { name: 'Chez Alice', slug: 'chez-alice-paris', city: 'Paris', account_status: 'active', image: null, address: '1 rue Exemple' } as DbRestaurant;
const menu = [{ name: 'Pizza', category: 'Plats', description: '', price: 12 }] as DbMenuItem[];
beforeEach(() => { document.head.innerHTML = '<title>Demo</title><meta name="robots" content="noindex"><link rel="canonical" href="capacitor://localhost/demo"><script id="demo-ld-json" type="application/ld+json">{}</script>'; });
describe('SPA restaurant SEO', () => {
  it('refreshes public canonical, name/city title and menu schema after another page', () => {
    setRestaurantHead(restaurant, menu, false);
    expect(document.title).toBe('Chez Alice à Paris : menu et commande');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://app.commandeici.com/chez-alice-paris');
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://app.commandeici.com/chez-alice-paris');
    const schema = JSON.parse(document.getElementById('restaurant-public-schema')!.textContent!);
    expect(schema.address.addressLocality).toBe('Paris');
    expect(schema.hasMenu.hasMenuSection[0].hasMenuItem[0].name).toBe('Pizza');
    expect(document.getElementById('demo-ld-json')).toBeNull();
  });
  it('keeps kiosk noindex and canonical clean, then restores normal page indexing', () => {
    setRestaurantHead(restaurant, menu, true);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
    setRestaurantHead(restaurant, menu, false);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });
  it('does not advertise demo or prospect fixtures as real restaurants', () => {
    for (const data of [{ ...restaurant, is_demo: true }, { ...restaurant, account_status: 'prospect' }]) {
      setRestaurantHead(data as DbRestaurant, menu, false);
      expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
      expect(document.getElementById('restaurant-public-schema')).toBeNull();
    }
  });
});
