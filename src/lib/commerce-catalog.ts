import type { AnalyzedCategory } from '@/types/onboarding';
import { randomUuid } from '@/lib/uuid';

export interface CatalogRow { id: string; name: string; price: string; category: string; description: string }
export const emptyCatalogRow = (category: string): CatalogRow => ({ id: randomUuid(), name: '', price: '', category, description: '' });
export function isCatalogDraft(value: unknown): value is CatalogRow[] {
  return Array.isArray(value) && value.length <= 500 && new Set(value.map(row => row?.id)).size === value.length && value.every(row => row && typeof row === 'object'
    && ['id','name','price','category','description'].every(key => typeof row[key] === 'string')
    && row.id.length > 0 && row.id.length <= 100 && row.name.length <= 160 && row.price.length <= 10 && row.category.length <= 80 && row.description.length <= 500);
}
export function catalogCategories(rows: CatalogRow[]): AnalyzedCategory[] | null {
  if (!isCatalogDraft(rows) || !rows.length) return null;
  const categories = new Map<string, AnalyzedCategory>();
  for (const row of rows) {
    const name = row.name.trim(), category = row.category.trim();
    const priceText = row.price.trim().replace(',', '.');
    if (!name || !category || !/^\d+(?:\.\d{1,2})?$/.test(priceText)) return null;
    const price = Number(priceText);
    if (!Number.isFinite(price) || price < 0 || price > 9999) return null;
    if (!categories.has(category)) categories.set(category, { name: category, items: [] });
    categories.get(category)!.items.push({ name, price, description: row.description.trim() });
  }
  return [...categories.values()];
}
