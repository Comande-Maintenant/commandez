import { expect, it } from 'vitest';
import { isLocalCommerceDemoPath } from '@/lib/commerce-demo-route';

it('keeps normalized local simulations out of production tracking', () => {
  for (const path of ['/decouvrir', '/DECOUVRIR/', '/de%63ouvrir', '/demo/epicerie', '/demo/fleuriste/', '/demo/%65picerie']) {
    expect(isLocalCommerceDemoPath(path)).toBe(true);
  }
  for (const path of ['/', '/inscription', '/admin/real-shop', '/real-shop', '/demo/unknown', '/demo/%']) {
    expect(isLocalCommerceDemoPath(path)).toBe(false);
  }
});
