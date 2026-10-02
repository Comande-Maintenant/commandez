import { escapeHtml, safeHttpUrl } from './html.ts';
type Restaurant = { name: string; slug: string; city?: string; address?: string; description?: string; restaurant_phone?: string; image?: string; hours?: string; is_demo?: boolean };
type Item = { name: string; category: string; description?: string; price: number };

export function restaurantDocument(restaurant: Restaurant, items: Item[]) {
  const url = `https://app.commandeici.com/${encodeURIComponent(restaurant.slug)}`;
  const name = escapeHtml(restaurant.name);
  const title = escapeHtml(`${restaurant.name}${restaurant.city ? ' à ' + restaurant.city : ''} : menu et commande`);
  const description = escapeHtml(restaurant.description || `Consultez le menu de ${restaurant.name}${restaurant.city ? ' à ' + restaurant.city : ''} et commandez directement au restaurant.`);
  const image = safeHttpUrl(restaurant.image, 'https://app.commandeici.com/images/covers/default.jpg');
  const schema = {
    '@context': 'https://schema.org', '@type': 'Restaurant', '@id': `${url}#restaurant`,
    name: restaurant.name, url, image,
    ...(restaurant.address || restaurant.city ? { address: { '@type': 'PostalAddress', streetAddress: restaurant.address || undefined, addressLocality: restaurant.city || undefined } } : {}),
    ...(restaurant.restaurant_phone ? { telephone: restaurant.restaurant_phone } : {}),
    hasMenu: { '@type': 'Menu', hasMenuSection: [...new Set(items.map(item => item.category))].map(category => ({
      '@type': 'MenuSection', name: category, hasMenuItem: items.filter(item => item.category === category).map(item => ({
        '@type': 'MenuItem', name: item.name, description: item.description || undefined,
        offers: { '@type': 'Offer', price: Number(item.price).toFixed(2), priceCurrency: 'EUR' },
      })),
    })) },
  };
  const head = `<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta name="robots" content="${restaurant.is_demo ? 'noindex, follow' : 'index, follow'}">
<meta property="og:title" content="${title}"><meta property="og:description" content="${description}">
<meta property="og:url" content="${escapeHtml(url)}"><meta property="og:type" content="website">
<meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image">
${restaurant.is_demo ? '' : `<script id="restaurant-public-schema" type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`}`;
  const body = `<main style="max-width:48rem;margin:2rem auto;padding:1rem;font-family:system-ui">
<h1>${name}</h1>${restaurant.is_demo ? '<p>Restaurant de démonstration, menu fictif.</p>' : ''}
<p>${description}</p><p>${escapeHtml([restaurant.address, restaurant.city].filter(Boolean).join(', '))}</p>
${restaurant.hours ? `<p>${escapeHtml(restaurant.hours)}</p>` : ''}
${[...new Set(items.map(item => item.category))].map(category => `<section><h2>${escapeHtml(category)}</h2><ul>${items.filter(item => item.category === category).map(item => `<li><strong>${escapeHtml(item.name)}</strong> : ${Number(item.price).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}</li>`).join('')}</ul></section>`).join('')}
<noscript>Activez JavaScript pour personnaliser et envoyer votre commande.</noscript></main>`;
  return { head, body, is_demo: !!restaurant.is_demo };
}
