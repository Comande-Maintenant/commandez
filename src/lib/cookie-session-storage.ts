import { randomUuid } from '@/lib/uuid';

const PART_SIZE = 3000;
const MAX_PARTS = 32;
const ATTRIBUTES = '; domain=.commandeici.com; path=/; secure; samesite=lax; max-age=2592000';
const EXPIRED = '; domain=.commandeici.com; path=/; secure; samesite=lax; max-age=0';

export function createCookieSessionStorage(readCookies: () => string, writeCookie: (cookie: string) => void) {
  const cookieMap = () => new Map(readCookies().split(';').map(pair => {
    const separator = pair.indexOf('=');
    if (separator < 0) return ['', ''] as const;
    return [pair.slice(0, separator).trim(), pair.slice(separator + 1)] as const;
  }).filter(([name]) => name));
  const expire = (name: string) => writeCookie(`${name}=${EXPIRED}`);
  const clearParts = (key: string, keep = new Set<string>()) => {
    const cookies = cookieMap();
    const manifest = `${key}.chunks`;
    if (cookies.has(manifest) && !keep.has(manifest)) expire(manifest);
    for (const name of cookies.keys()) {
      if (name !== manifest && name.startsWith(`${key}.`) && !keep.has(name)) expire(name);
    }
  };

  return {
    getItem(key: string): string | null {
      const cookies = cookieMap();
      const manifest = cookies.get(`${key}.chunks`);
      let encoded = cookies.get(key);
      if (manifest !== undefined) {
        const match = /^v1:([a-f0-9-]{36}):([1-9][0-9]*)$/.exec(manifest);
        if (!match || Number(match[2]) > MAX_PARTS) return null;
        const parts = [];
        for (let index = 0; index < Number(match[2]); index++) {
          const part = cookies.get(`${key}.${match[1]}.${index}`);
          if (part === undefined) return null;
          parts.push(part);
        }
        encoded = parts.join('');
      }
      if (encoded === undefined) return null;
      try { return decodeURIComponent(encoded); }
      catch { return null; }
    },
    setItem(key: string, value: string): void {
      const encoded = encodeURIComponent(value);
      if (encoded.length <= PART_SIZE) {
        writeCookie(`${key}=${encoded}${ATTRIBUTES}`);
        clearParts(key);
        return;
      }
      const count = Math.ceil(encoded.length / PART_SIZE);
      if (count > MAX_PARTS) throw new Error('Authentication session exceeds cookie storage capacity');
      const generation = randomUuid();
      const keep = new Set([`${key}.chunks`]);
      for (let index = 0; index < count; index++) {
        const name = `${key}.${generation}.${index}`;
        keep.add(name);
        writeCookie(`${name}=${encoded.slice(index * PART_SIZE, (index + 1) * PART_SIZE)}${ATTRIBUTES}`);
      }
      // Commit the new generation only after every part has been written.
      writeCookie(`${key}.chunks=v1:${generation}:${count}${ATTRIBUTES}`);
      expire(key);
      clearParts(key, keep);
    },
    removeItem(key: string): void {
      expire(key);
      clearParts(key);
    },
  };
}

export const cookieSessionStorage = createCookieSessionStorage(
  () => document.cookie,
  cookie => { document.cookie = cookie; },
);
