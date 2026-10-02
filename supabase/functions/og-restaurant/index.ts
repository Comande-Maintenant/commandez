import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { escapeHtml } from '../_shared/html.ts';
import { restaurantDocument } from '../_shared/restaurant-document.ts';
const backend = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
Deno.serve(async req => {
  const url = new URL(req.url);
  if (!['GET','HEAD'].includes(req.method)) return new Response('Method not allowed', { status: 405 });
  const supabase = backend();
  if (url.searchParams.get('format') === 'sitemap') {
    const { data, error } = await supabase.rpc('list_public_restaurants');
    if (error) return new Response('Unavailable', { status: 503 });
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${(data || []).map((row: { slug: string; updated_at: string }) => `<url><loc>https://app.commandeici.com/${escapeHtml(encodeURIComponent(row.slug))}</loc><lastmod>${new Date(row.updated_at).toISOString()}</lastmod></url>`).join('')}</urlset>`;
    return new Response(xml, { headers: { 'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300' } });
  }
  const slug = url.searchParams.get('slug');
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>170) return new Response('Invalid slug',{ status:400 });
  const { data: restaurant, error } = await supabase.rpc('get_public_restaurant_by_slug', { p_slug: slug });
  if (error) return new Response('Unavailable', { status: 503 });
  if (!restaurant || restaurant.deactivated_at || (!restaurant.is_demo && restaurant.account_status !== 'active')) return new Response('Not found', { status: 404 });
  const { data: items, error: menuError } = await supabase.from('menu_items').select('name,category,description,price').eq('restaurant_id',restaurant.id).eq('enabled',true).order('sort_order').limit(500);
  if (menuError) return new Response('Unavailable', { status: 503 });
  const document = restaurantDocument(restaurant, items || []);
  const headers = { 'cache-control':'public, max-age=300','x-content-type-options':'nosniff' };
  if (url.searchParams.get('format') === 'json') return new Response(JSON.stringify(document), { headers: { ...headers, 'content-type':'application/json; charset=utf-8' } });
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="UTF-8">${document.head}</head><body>${document.body}</body></html>`, { headers: { ...headers, 'content-type':'text/html; charset=utf-8' } });
});
