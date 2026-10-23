export const businessTypes = ['restaurant', 'epicerie', 'fleuriste'] as const;
export type BusinessType = typeof businessTypes[number];
export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (businessTypes as readonly string[]).includes(value);
}
export function businessTypeHint(value: unknown): BusinessType {
  return isBusinessType(value) ? value : 'restaurant';
}
export const businessTypeLabel = { restaurant: 'commerce.restaurant', epicerie: 'commerce.grocery', fleuriste: 'commerce.florist' } as const;
