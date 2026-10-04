import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(() => ({ select: () => ({ like: async () => ({ data: [], error: null }) }) })) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
import { generateSlug } from '@/services/onboarding';
beforeEach(() => vi.clearAllMocks());
describe('restaurant slug candidate', () => {
  it('includes the name and city, without requiring access to other owners restaurants', async () => {
    expect(await generateSlug('Le Cœur & Café', 'L’Haÿ-les-Roses')).toBe('le-coeur-cafe-l-hay-les-roses');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects a blank restaurant name', async () => {
    await expect(generateSlug('  ', 'Paris')).rejects.toThrow();
  });
  it('avoids routes reserved by the application', async () => {
    for (const name of ['demo', 'admin', 'inscription', 'order']) {
      expect(await generateSlug(name)).toBe(`restaurant-${name}`);
    }
  });
  it.each(['Découvrir', 'decouvrir', 'DECOUVRIR'])('keeps the discovery route available for %s', async (name) => {
    expect(await generateSlug(name)).toBe('restaurant-decouvrir');
  });
  it('bounds long names and ignores a whitespace-only city', async () => {
    expect((await generateSlug('Restaurant '.repeat(30), 'Paris')).length).toBeLessThanOrEqual(140);
    expect(await generateSlug('Chez Alice', '  ')).toBe('chez-alice');
  });
  const locales = [ ['fr', 'Chez André', 'Paris'], ['en', 'Alice Kitchen', 'London'], ['es', 'Casa José', 'Madrid'], ['de', 'Schöne Küche', 'Berlin'], ['it', 'Caffè Roma', 'Roma'], ['pt', 'João Café', 'Lisboa'], ['nl', 'Eetcafé', 'Utrecht'], ['ar', 'مطعم الأمل', 'دبي'], ['zh', '幸福饭店', '北京'], ['ja', 'さくら食堂', '東京'], ['ko', '행복식당', '서울'], ['ru', 'Ресторан', 'Москва'], ['tr', 'İstanbul Şiş', 'İstanbul'], ['vi', 'Phở Việt', 'Hà Nội'] ];
  it.each(locales)('creates a stable valid slug for %s', async (_locale, name, city) => {
    const slug = await generateSlug(name, city);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(slug.length).toBeLessThanOrEqual(140);
    expect(await generateSlug(name, city)).toBe(slug);
  });
});
