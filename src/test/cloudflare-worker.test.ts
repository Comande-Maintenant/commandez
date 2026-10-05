import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../public/_worker.js';
const spa = '<html><head><title>App</title><meta name="description" content="old"><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>';
const env = () => ({ ASSETS: { fetch: vi.fn().mockImplementation(() => Promise.resolve(new Response(spa))) } });
afterEach(() => vi.unstubAllGlobals());
describe('public restaurant HTML and application preservation', () => {
  for (const ua of ['Mozilla/5.0', 'Googlebot/1.0', 'facebookexternalhit/1.1']) {
    it(`serves identical menu HTML and SPA scripts to ${ua}`, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ head: '<title>Chez Alice</title>', body: '<main><h1>Chez Alice</h1><p>Pizza</p></main>', is_demo: false }))));
      const response = await worker.fetch(new Request('https://app.commandeici.com/chez-alice', { headers: { 'user-agent': ua } }), env());
      const html = await response.text();
      expect(response.status).toBe(200); expect(html).toContain('<h1>Chez Alice</h1>'); expect(html).toContain('/assets/app.js');
      expect(html).not.toContain('<title>App</title>'); expect(response.headers.get('vary')).not.toBe('User-Agent');
    });
  }
  it('keeps private application routes out of indexing without intercepting assets', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const response = await worker.fetch(new Request('https://app.commandeici.com/admin/demo'), env());
    expect(response.headers.get('x-robots-tag')).toContain('noindex'); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['GET', 'HEAD'].flatMap(method => ['/decouvrir', '/decouvrir/', '/DECOUVRIR', '/de%63ouvrir', '/demo/epicerie', '/demo/fleuriste', '/demo/epicerie/', '/demo/%66leuriste'].map(path => [method, path])))('serves local demo %s %s without a merchant lookup', async (method, path) => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const response = await worker.fetch(new Request('https://app.commandeici.com' + path, { method }), env());
    expect(response.status).toBe(200); expect(response.headers.get('x-robots-tag')).toContain('noindex');
    if (method === 'HEAD') expect(await response.text()).toBe(''); else expect(await response.text()).toContain('/assets/app.js');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('returns a real 404 with the SPA for unknown slugs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const response = await worker.fetch(new Request('https://app.commandeici.com/unknown'), env());
    expect(response.status).toBe(404); expect(await response.text()).toContain('/assets/app.js');
  });
  it('preserves navigation during a backend outage and avoids indexing empty fallback HTML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const response = await worker.fetch(new Request('https://app.commandeici.com/chez-alice'), env());
    expect(response.status).toBe(200); expect(await response.text()).toContain('/assets/app.js'); expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });
  it('excludes demos and kiosk duplicates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ head: '', body: 'demo', is_demo: true })))));
    const response = await worker.fetch(new Request('https://app.commandeici.com/demo?kiosk=true'), env());
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });
});
