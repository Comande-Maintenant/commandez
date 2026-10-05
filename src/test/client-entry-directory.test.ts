import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ rpc: vi.fn(), abort: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: api.rpc } }));
import { findPublicCommerces, validateCity } from '@/services/public-commerces';
const fixture = { slug: 'mock-flowers', name: 'Mock flowers', city: 'Évreux', image: null, cover_image: null, cuisine: null, cuisine_type: null, business_type: 'fleuriste' };
beforeEach(() => {
  vi.clearAllMocks();
  api.abort.mockImplementation(() => Promise.resolve({ data: { items: [fixture], has_more: false }, error: null }));
  api.rpc.mockReturnValue({ abortSignal: api.abort });
});
it('accepts accented, international and apostrophe city names and normalizes whitespace and Unicode', () => {
  expect(validateCity('  Évreux  ')).toBe('Évreux');
  expect(validateCity("L’Haÿ-les-Roses")).toBe("L’Haÿ-les-Roses");
  expect(validateCity('Saint  Pierre')).toBe('Saint Pierre');
  expect(validateCity('東京')).toBe('東京');
});
it('rejects empty, oversized, control and query injection input before any RPC', async () => {
  for (const input of ['', ' ', 'x'.repeat(81), '1234', 'Auxerre\nParis', "x');DROP TABLE restaurants;--", '<Paris>', 'Paris%']) {
    expect(validateCity(input)).toBeNull();
    await expect(findPublicCommerces(input)).rejects.toThrow();
  }
  expect(api.rpc).not.toHaveBeenCalled();
});
it('uses only the city RPC and its bound city parameter and cancellation signal', async () => {
  const signal = new AbortController().signal;
  const result = await findPublicCommerces(' Évreux ', signal);
  expect(api.rpc).toHaveBeenCalledWith('list_public_commerces_by_city', { p_city: 'Évreux' });
  expect(api.abort).toHaveBeenCalledWith(signal);
  expect(result).toEqual({ items: [fixture], has_more: false });
});
it('returns an empty list only after a successful valid empty response', async () => {
  api.abort.mockResolvedValue({ data: { items: [], has_more: false }, error: null });
  await expect(findPublicCommerces('Paris')).resolves.toEqual({ items: [], has_more: false });
});
it('preserves explicit partial-results information', async () => {
  api.abort.mockResolvedValue({ data: { items: Array.from({ length: 100 }, (_, index) => ({ ...fixture, slug: 'mock-' + index })), has_more: true }, error: null });
  expect((await findPublicCommerces('Évreux')).has_more).toBe(true);
});
it('rejects backend failures rather than claiming no shops', async () => {
  api.abort.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
  await expect(findPublicCommerces('Paris')).rejects.toThrow();
  api.abort.mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(findPublicCommerces('Paris')).rejects.toThrow();
});
it('rejects malformed, overly large, private-field and wrong-city responses', async () => {
  for (const data of [null, [], { items: [], has_more: 'false' }, { items: [{ ...fixture, owner_id: 'private' }], has_more: false }, { items: [{ ...fixture, city: 'Paris' }], has_more: false }, { items: Array(101).fill(fixture), has_more: false }, { items: [{ ...fixture, slug: '../admin' }], has_more: false }]) {
    api.abort.mockResolvedValue({ data, error: null });
    await expect(findPublicCommerces('Évreux')).rejects.toThrow();
  }
});
it('does not allow an unsafe external image protocol in directory cards', async () => {
  api.abort.mockResolvedValue({ data: { items: [{ ...fixture, image: 'javascript:alert(1)' }], has_more: false }, error: null });
  await expect(findPublicCommerces('Évreux')).rejects.toThrow();
});

it('matches an accented published city when the user omits accents, and folds curly apostrophes', async () => {
 await expect(findPublicCommerces('Evreux')).resolves.toMatchObject({ items: [fixture] });
 api.abort.mockResolvedValue({ data: { items: [{ ...fixture, city: "L’Haÿ-les-Roses" }], has_more: false }, error: null });
 await expect(findPublicCommerces("L'Hay-les-Roses")).resolves.toMatchObject({ items: [{ city: "L’Haÿ-les-Roses" }] });
});

it('accepts real Arabic, Thai and Tamil city spellings containing non-composable marks', async () => {
 for (const city of ['القَاهِرَة', 'دُبَيّ', 'เชียงใหม่', 'กรุงเทพฯ', 'மதுரை']) {
   expect(validateCity(city)).toBe(city);
   api.abort.mockResolvedValue({ data: { items: [{ ...fixture, city }], has_more: false }, error: null });
   await expect(findPublicCommerces(city)).resolves.toMatchObject({ items: [{ city }] });
 }
});
