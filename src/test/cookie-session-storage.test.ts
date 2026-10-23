import { describe, expect, it } from 'vitest';
import { createCookieSessionStorage } from '@/lib/cookie-session-storage';

function browserCookieJar() {
  const cookies = new Map<string, string>();
  const writes: string[] = [];
  const read = () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  const write = (cookie: string) => {
    writes.push(cookie);
    if (new TextEncoder().encode(cookie).length > 4096) return;
    const pair = cookie.split(';')[0];
    const separator = pair.indexOf('=');
    const key = pair.slice(0, separator);
    if (cookie.includes('max-age=0')) cookies.delete(key);
    else cookies.set(key, pair.slice(separator + 1));
  };
  return { cookies, writes, read, write, storage: createCookieSessionStorage(read, write) };
}

const largeSession = JSON.stringify({ access_token: 'a'.repeat(1500), provider_token: 'b'.repeat(900), refresh_token: 'r'.repeat(100), user: { name: 'Émilie العربية'.repeat(300) } });

describe('Cross-subdomain authentication cookies', () => {
  it('keeps small existing sessions readable', () => {
    const jar = browserCookieJar();
    jar.cookies.set('commandeici_auth', encodeURIComponent('{"access_token":"legacy"}'));
    expect(jar.storage.getItem('commandeici_auth')).toBe('{"access_token":"legacy"}');
  });

  it('retains a large Google session after creating a new storage instance', () => {
    const jar = browserCookieJar();
    jar.storage.setItem('commandeici_auth', largeSession);
    const afterReload = createCookieSessionStorage(jar.read, jar.write);
    expect(afterReload.getItem('commandeici_auth')).toBe(largeSession);
    expect(jar.writes.every(value => new TextEncoder().encode(value).length <= 4096)).toBe(true);
    expect(jar.writes.every(value => value.includes('domain=.commandeici.com') && value.includes('path=/'))).toBe(true);
  });

  it('removes every previous session part when a smaller session replaces it', () => {
    const jar = browserCookieJar();
    jar.storage.setItem('commandeici_auth', largeSession);
    jar.storage.setItem('commandeici_auth', '{"access_token":"small"}');
    expect(jar.storage.getItem('commandeici_auth')).toBe('{"access_token":"small"}');
    expect([...jar.cookies.keys()]).toEqual(['commandeici_auth']);
  });

  it('removes the full session on sign out and preserves unrelated cookies', () => {
    const jar = browserCookieJar();
    jar.cookies.set('preference', 'fr');
    jar.storage.setItem('commandeici_auth', largeSession);
    jar.storage.removeItem('commandeici_auth');
    expect(jar.storage.getItem('commandeici_auth')).toBeNull();
    expect([...jar.cookies.keys()]).toEqual(['preference']);
  });

  it('treats a malformed cookie as an absent session', () => {
    const jar = browserCookieJar();
    jar.cookies.set('commandeici_auth', '%invalid');
    expect(jar.storage.getItem('commandeici_auth')).toBeNull();
  });

  it('rejects incomplete session parts instead of returning a partial value', () => {
    const jar = browserCookieJar();
    jar.storage.setItem('commandeici_auth', largeSession);
    const firstPart = [...jar.cookies.keys()].find(key => key.endsWith('.0'));
    expect(firstPart).toBeDefined();
    jar.cookies.delete(firstPart!);
    expect(jar.storage.getItem('commandeici_auth')).toBeNull();
  });

  it.each(['{"access_token":"short"}', largeSession.replace('provider_token', 'provider_refresh_token')])(
    'keeps concurrent readers on a complete session throughout refresh', (replacement) => {
      const jar = browserCookieJar();
      jar.storage.setItem('commandeici_auth', largeSession);
      const reader = createCookieSessionStorage(jar.read, jar.write);
      const observed: Array<string | null> = [];
      const writer = createCookieSessionStorage(jar.read, cookie => {
        jar.write(cookie);
        observed.push(reader.getItem('commandeici_auth'));
      });
      writer.setItem('commandeici_auth', replacement);
      expect(observed.every(value => value === largeSession || value === replacement)).toBe(true);
      expect(reader.getItem('commandeici_auth')).toBe(replacement);
    },
  );
});
