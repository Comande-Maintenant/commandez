const FUNCTIONS = 'https://tgtvkzmokypztdudwzne.supabase.co/functions/v1';
const RESERVED = new Set(['abonnement','abonnement-confirme','admin','choisir-plan','connexion','decouvrir','inscription','mot-de-passe-oublie','order','profil','reinitialiser-mot-de-passe','signup','suivi','super-admin','unsubscribe','upload']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);
    if (url.pathname === '/sitemap.xml') {
      try {
        const result = await fetch(`${FUNCTIONS}/og-restaurant?format=sitemap`, { signal: AbortSignal.timeout(3000) });
        if (!result.ok) return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'retry-after': '60' } });
        return new Response(request.method === 'HEAD' ? null : result.body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' } });
      } catch { return new Response('Sitemap temporarily unavailable', { status: 503 }); }
    }
    let localDemoPath = url.pathname;
    try { localDemoPath = decodeURI(localDemoPath); } catch { /* Keep malformed paths unchanged. */ }
    const localDemo = ['/decouvrir', '/demo/epicerie', '/demo/fleuriste'].includes(localDemoPath.toLowerCase().replace(/\/+$/, ''));
    const segments = url.pathname.split('/').filter(Boolean);
    if (localDemo || segments.length !== 1 || RESERVED.has(segments[0]) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segments[0])) {
      const asset = await env.ASSETS.fetch(request);
      if (localDemo || (segments[0] && RESERVED.has(segments[0]))) {
        const headers = new Headers(asset.headers); headers.set('x-robots-tag','noindex, follow');
        return new Response(request.method === 'HEAD' ? null : asset.body, { status: asset.status, headers });
      }
      return asset;
    }
    const asset = await env.ASSETS.fetch(request);
    try {
      const result = await fetch(`${FUNCTIONS}/og-restaurant?format=json&slug=${encodeURIComponent(segments[0])}`, { redirect: 'manual', signal: AbortSignal.timeout(3000) });
      const headers = new Headers(asset.headers);
      headers.set('content-type', 'text/html; charset=utf-8');
      headers.set('x-content-type-options', 'nosniff');
      // User-specific cookie responses must never become a cached shared page.
      headers.set('cache-control', 'private, no-cache');
      if (result.status === 404) {
        headers.set('x-robots-tag', 'noindex, follow');
        return new Response(request.method === 'HEAD' ? null : asset.body, { status: 404, headers });
      }
      if (!result.ok) throw new Error('Restaurant document unavailable');
      const document = await result.json();
      if (typeof document.head !== 'string' || typeof document.body !== 'string') throw new Error('Invalid document');
      if (document.is_demo || url.searchParams.has('kiosk')) headers.set('x-robots-tag', 'noindex, follow');
      const html = (await asset.text())
        .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
        .replace(/<meta\b[^>]*(?:name=["'](?:description|robots|twitter:[^"']+)["']|property=["']og:[^"']+["'])[^>]*>/gi, '')
        .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
        .replace('</head>', `${document.head}</head>`)
        .replace(/<div id="root"><\/div>/, `<div id="root">${document.body}</div>`);
      headers.delete('content-length');
      return new Response(request.method === 'HEAD' ? null : html, { status: 200, headers });
    } catch {
      const headers = new Headers(asset.headers); headers.set('x-robots-tag', 'noindex, follow');
      return new Response(request.method === 'HEAD' ? null : asset.body, { status: asset.status, headers });
    }
  },
};
