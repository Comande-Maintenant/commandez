import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearEntryRole, readEntryPreference, rememberEntryCity, rememberEntryRole } from '@/lib/entry-preferences';
beforeEach(() => { localStorage.clear(); });
afterEach(() => vi.restoreAllMocks());
it('does not treat malformed or unknown saved values as account authorization', () => {
 for (const value of ['broken-json', 'null', '[]', '"client"', '{"role":"super_admin","city":42}', '{"role":"client","city":"<invalid>"}']) {
  localStorage.setItem('commandeici.entry.v1', value);
  const result = readEntryPreference();
  expect(result.role === null || result.role === 'client').toBe(true);
  expect(result.city).toBe('');
 }
});
it('preserves the city across mode changes and clearing the entry preference', () => {
 rememberEntryCity('Auxerre'); rememberEntryRole('client'); rememberEntryRole('merchant');
 expect(readEntryPreference()).toEqual({ role: 'merchant', city: 'Auxerre' });
 clearEntryRole(); expect(readEntryPreference()).toEqual({ role: null, city: 'Auxerre' });
});
it('keeps journeys usable if preference writes throw', () => {
 vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
 expect(() => rememberEntryRole('client')).not.toThrow();
 expect(() => rememberEntryCity('Auxerre')).not.toThrow();
 expect(() => clearEntryRole()).not.toThrow();
});
