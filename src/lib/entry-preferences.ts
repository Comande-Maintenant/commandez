export type EntryRole = 'client' | 'merchant';
export interface EntryPreference { role: EntryRole | null; city: string }
const key = 'commandeici.entry.v1';

export function readEntryPreference(): EntryPreference {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { role: null, city: '' };
    const role = value.role === 'client' || value.role === 'merchant' ? value.role : null;
    const city = typeof value.city === 'string' && value.city.length <= 80 && !/[\p{C}<>]/u.test(value.city) ? value.city.trim().normalize('NFC') : '';
    return { role, city };
  } catch { return { role: null, city: '' }; }
}
function persist(value: EntryPreference): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The journey also works without storage. */ }
}
export function rememberEntryRole(role: EntryRole): void { persist({ ...readEntryPreference(), role }); }
export function rememberEntryCity(city: string): void { persist({ ...readEntryPreference(), city }); }
export function clearEntryRole(): void { persist({ ...readEntryPreference(), role: null }); }
