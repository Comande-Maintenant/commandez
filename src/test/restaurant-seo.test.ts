import { describe, expect, it } from 'vitest';
import { restaurantDocument } from '../../supabase/functions/_shared/restaurant-document';
const restaurant = { name: 'Chez Alice', slug: 'chez-alice-paris', city: 'Paris', address: '1 rue Exemple', is_demo: false, account_status: 'active' };
describe('public restaurant document', () => {
  it('includes the real menu, canonical URL and Restaurant schema without a refresh', () => {
    const doc = restaurantDocument(restaurant, [{ name: 'Pizza', category: 'Plats', description: 'Tomate', price: 12 }]);
    expect(doc.head).toContain('rel="canonical"');
    expect(doc.head).toContain('https://app.commandeici.com/chez-alice-paris');
    expect(doc.head).toContain('"@type":"Restaurant"');
    expect(doc.body).toContain('<h1>Chez Alice</h1>');
    expect(doc.body).toContain('Pizza');
    expect(doc.body).toContain('12,00');
    expect(doc.head).not.toContain('http-equiv="refresh"');
    expect(doc.head).not.toContain('aggregateRating');
  });
  it('escapes menu markup and JSON-LD script delimiters', () => {
    const doc = restaurantDocument({ ...restaurant, name: '</script><img onerror=x>' }, [{ name: '<svg onload=x>', category: 'Main', price: 2 }]);
    expect(doc.body).not.toContain('<svg');
    expect(doc.body).toContain('&lt;svg');
    expect(doc.head).not.toContain('</script><img');
  });
  it('does not represent a demo as a real restaurant', () => {
    const doc = restaurantDocument({ ...restaurant, is_demo: true }, []);
    expect(doc.head).toContain('noindex');
    expect(doc.head).not.toContain('"@type":"Restaurant"');
  });
});
