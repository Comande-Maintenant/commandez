import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, it, expect, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;
function loadEdge(name: string, fetcher: typeof fetch) {
  let handler!: Handler;
  const source = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8').replace(/^import .*;\n/gm, '');
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Function('serve', 'requireUser', 'Deno', 'fetch', 'signToken', 'verifyToken', javascript)(
    (fn: Handler) => { handler = fn; }, async () => ({ id: 'owner-1' }),
    { env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://test.supabase.co' : 'test-secret' } },
    fetcher, async () => 'signed-photo', async () => null,
  );
  return (body: unknown) => handler(new Request('https://test.supabase.co/functions/v1/test', { method: 'POST', body: JSON.stringify(body) }));
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const menu = { categories: [{ name: 'Plats', items: [{ name: 'Pizza', price: 9, description: '', variants: [], supplements: [], tags: [] }] }] };
const signed = 'https://test.supabase.co/storage/v1/object/sign/menu-uploads/owner-1/carte.pdf?token=example';

describe('Google Places runtime contract', () => {
  it('reports Google quota failures as an error instead of an empty successful search', async () => {
    const handler = loadEdge('google-places', vi.fn().mockResolvedValue(json({ status: 'OVER_QUERY_LIMIT' })));
    const response = await handler({ action: 'search', query: 'Pizza Auxerre' });
    expect(response.status).toBe(502);
    expect(await response.json()).toHaveProperty('error');
  });
  it('rejects coordinates with missing values before calling Google', async () => {
    const fetcher = vi.fn();
    const response = await loadEdge('google-places', fetcher)({ action: 'nearby', lat: null, lng: '' });
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('allows zero search results without treating them as a provider outage', async () => {
    const response = await loadEdge('google-places', vi.fn().mockResolvedValue(json({ status: 'ZERO_RESULTS', results: [] })))({ action: 'search', query: 'Unknown restaurant' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [] });
  });
  it('refuses redirects of shared Google links to other hosts', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }));
    const response = await loadEdge('google-places', fetcher)({ action: 'resolve_url', url: 'https://share.google/example' });
    expect(response.status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].redirect).toBe('manual');
  });
  it('requests structured city information and returns attribution for photos', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ status: 'OK', result: { place_id: 'place-1', name: 'Pizza', address_components: [{ long_name: 'Auxerre', types: ['locality'] }], photos: [{ photo_reference: 'reference', html_attributions: ['Photographe'] }] } }));
    const response = await loadEdge('google-places', fetcher)({ action: 'details', placeId: 'place-1' });
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('fields')).toContain('address_components');
    const data = await response.json();
    expect(data.result.city).toBe('Auxerre');
    expect(data.result.photo_urls[0].attribution).toBe('Photographe');
  });
});
describe('Menu analysis runtime contract', () => {
  it('sends signed PDFs as documents even when the signed URL has query parameters', async () => {
    const fetcher = vi.fn().mockImplementation(async () => json({ content: [{ type: 'text', text: JSON.stringify(menu) }] }));
    const response = await loadEdge('analyze-menu', fetcher)({ imageUrls: [signed] });
    expect(response.status).toBe(200);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).messages[0].content[0].type).toBe('document');
  });
  it('stops on a failed page instead of returning an incomplete menu', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ content: [{ text: JSON.stringify(menu) }] })).mockImplementation(async () => json({ error: 'quota' }, 429));
    const response = await loadEdge('analyze-menu', fetcher)({ imageUrls: [signed, signed.replace('carte.pdf', 'page2.jpg')] });
    expect(response.status).toBe(502);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects unreadable model output instead of claiming a successful empty import', async () => {
    const fetcher = vi.fn().mockImplementation(async () => json({ content: [{ text: 'invalid JSON' }] }));
    const response = await loadEdge('analyze-menu', fetcher)({ imageUrls: [signed] });
    expect(response.status).toBe(502);
  });
  it('does not silently ignore a page with no readable items', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ content: [{ text: JSON.stringify(menu) }] })).mockImplementation(async () => json({ content: [{ text: '{"categories": []}' }] }));
    const response = await loadEdge('analyze-menu', fetcher)({ imageUrls: [signed, signed.replace('carte.pdf', 'page2.jpg')] });
    expect(response.status).toBe(502);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('retains a valid raw menu when optional cross referencing fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ content: [{ text: JSON.stringify(menu) }] })).mockResolvedValueOnce(json({ error: 'quota' }, 429));
    const response = await loadEdge('analyze-menu', fetcher)({ imageUrls: [signed] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(menu);
  });
  it('rejects storage traversal before invoking the model', async () => {
    const fetcher = vi.fn();
    const response = await loadEdge('analyze-menu', fetcher)({ imageUrls: [signed.replace('carte.pdf', '../another-owner/menu.pdf')] });
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
