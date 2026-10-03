import { describe, expect, it } from 'vitest';
import { nativeRoute } from '@/lib/native';
describe('native links', () => {
  it('keeps authenticated callback fragments for session recovery', () => {
    expect(nativeRoute('commandeici://auth/inscription#access_token=abc&refresh_token=def')).toBe('/inscription#access_token=abc&refresh_token=def');
    expect(nativeRoute('https://app.commandeici.com/demo?lang=fr')).toBe('/demo?lang=fr');
  });
  it('preserves the OAuth callback query and permits checkout/account paths', () => {
    expect(nativeRoute('commandeici://auth/order?code=callback-code')).toBe('/order?code=callback-code');
    expect(nativeRoute('commandeici://auth/connexion?code=callback-code')).toBe('/connexion?code=callback-code');
  });
  it('rejects foreign hosts, schemes and account administration callbacks', () => {
    for (const url of ['https://evil.test/inscription', 'javascript:alert(1)', 'commandeici://evil/inscription', 'commandeici://auth/super-admin', 'commandeici://auth//evil.test']) expect(nativeRoute(url)).toBeNull();
  });
});
