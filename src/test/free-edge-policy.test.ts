import { expect, it } from 'vitest';
import { freeAccessResponse, FREE_ACCESS } from '../../supabase/functions/_shared/access-policy';
import { readFileSync } from 'node:fs';
it('free mode prevents checkout creation and expiry emails before any provider call', () => {
  expect(FREE_ACCESS).toBe(true);
  expect(freeAccessResponse()).toEqual({ skipped: true, reason: 'currently_free', checkout: false });
  for (const file of ['stripe-checkout', 'trial-reminders']) {
    const source = readFileSync(`supabase/functions/${file}/index.ts`, 'utf8');
    expect(source.indexOf('if (FREE_ACCESS)')).toBeGreaterThan(0);
    expect(source.indexOf('if (FREE_ACCESS)')).toBeLessThan(source.indexOf(file === 'stripe-checkout' ? 'const stripeKey' : 'const supabase = createServiceClient()'));
  }
});
