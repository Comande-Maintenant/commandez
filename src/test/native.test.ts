import { describe, expect, it } from 'vitest';
import { nativeRoute } from '@/lib/native';
describe('native links', () => {
  it('keeps authenticated callback fragments for session recovery', () => {
    expect(nativeRoute('commandeici://auth/inscription#access_token=abc&refresh_token=def')).toBe('/inscription#access_token=abc&refresh_token=def');
    expect(nativeRoute('https://app.commandeici.com/demo?lang=fr')).toBe('/demo?lang=fr');
  });
  it('rejects foreign hosts, schemes and account administration callbacks', () => {
    for (const url of ['https://evil.test/inscription', 'javascript:alert(1)', 'commandeici://evil/inscription', 'commandeici://auth/super-admin', 'commandeici://auth//evil.test']) expect(nativeRoute(url)).toBeNull();
  });
});
