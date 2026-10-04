import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';

const translations = (language: string): Record<string, string> => JSON.parse(readFileSync(new URL(`../src/i18n/${language}.json`, import.meta.url), 'utf8'));
const fr = translations('fr');
const de = translations('de');
const ar = translations('ar');

async function fakeHistory(page: Page, orders: (route: Route) => Promise<void>) {
  const writes: string[] = [];
  await page.route(url => url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/'), async route => {
    if (route.request().method() !== 'GET') {
      writes.push(route.request().url());
      await route.fulfill({ status: 400, json: { message: 'History tests must remain read-only' } });
    } else if (new URL(route.request().url()).pathname.endsWith('/orders')) await orders(route);
    else await route.fulfill({ json: [] });
  });
  return writes;
}

for (const [lang, strings] of [['fr', fr], ['de', de], ['ar', ar]] as const) {
  test(`empty history exits fit 320px and restore focus in ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const writes = await fakeHistory(page, route => route.fulfill({ json: [] }));
    await page.goto(`/e2e/fixtures/history-navigation.html?lang=${lang}`);
    const trigger = page.getByRole('button', { name: strings['dashboard.history.title'], exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: strings['dashboard.history.title'] });
    await expect(dialog.getByText(strings['dashboard.history.empty'])).toBeVisible();
    await expect.poll(async () => dialog.evaluate(element => Math.abs(element.getBoundingClientRect().right - innerWidth))).toBeLessThan(0.5);
    if (lang === 'ar') await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    for (const name of [strings['nav.back'], strings['common.close']]) {
      const button = dialog.getByRole('button', { name, exact: true });
      await expect(button).toBeVisible();
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(320);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog.getByRole('button', { name: strings['nav.back'], exact: true }).click();
    await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
    await trigger.click(); await dialog.getByRole('button', { name: strings['common.close'], exact: true }).click();
    await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog.getByRole('button', { name: strings['nav.back'], exact: true })).toBeFocused();
    await expect.poll(async () => dialog.evaluate(element => Math.abs(element.getBoundingClientRect().right - innerWidth))).toBeLessThan(0.5);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
    expect(writes).toEqual([]);
  });
}

test('a pending history request never prevents returning to the dashboard', async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const writes = await fakeHistory(page, async route => { await waiting; await route.fulfill({ json: [] }); });
  await page.goto('/e2e/fixtures/history-navigation.html?lang=fr');
  const trigger = page.getByRole('button', { name: fr['dashboard.history.title'], exact: true });
  await trigger.click();
  try {
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('status', { name: fr['common.loading'] })).toBeVisible();
    await dialog.getByRole('button', { name: fr['nav.back'], exact: true }).click();
    await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
  } finally { release(); }
  expect(writes).toEqual([]);
});

test('an unavailable history stays escapable and a retry restores its orders', async ({ page }) => {
  let attempts = 0;
  const writes = await fakeHistory(page, route => ++attempts === 1
    ? route.fulfill({ status: 503, json: { message: 'Fixture offline' } })
    : route.fulfill({ json: [{ id: 'history-1', order_number: 1, daily_number: 1, created_at: new Date().toISOString(), status: 'done', order_type: 'collect', customer_phone: '', items: [{ name: 'Kebab historique', quantity: 1, price: 6.5 }], total: 6.5 }] }));
  await page.goto('/e2e/fixtures/history-navigation.html?lang=fr');
  await page.getByRole('button', { name: fr['dashboard.history.title'], exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toHaveText(fr['common.error']);
  await expect(dialog.getByRole('button', { name: fr['nav.back'], exact: true })).toBeVisible();
  await expect(dialog.getByText(fr['dashboard.history.empty'])).toHaveCount(0);
  await dialog.getByRole('button', { name: fr['common.retry'], exact: true }).click();
  await expect(dialog.getByText('Kebab historique', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: fr['common.close'], exact: true }).click();
  await expect(dialog).toBeHidden(); expect(attempts).toBe(2); expect(writes).toEqual([]);
});

for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`scrolling and an expanded detail keep the exits visible at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    const orders = Array.from({ length: 40 }, (_, index) => ({ id: `history-${index}`, order_number: index + 1, daily_number: index + 1, created_at: new Date(Date.now() - index * 60000).toISOString(), status: 'done', order_type: 'collect', customer_phone: '', items: [{ name: `Produit historique ${index}`, quantity: 1, price: 6.5 }], total: 6.5 }));
    const writes = await fakeHistory(page, route => route.fulfill({ json: orders }));
    await page.goto('/e2e/fixtures/history-navigation.html?lang=fr');
    const trigger = page.getByRole('button', { name: fr['dashboard.history.title'], exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    const back = dialog.getByRole('button', { name: fr['nav.back'], exact: true });
    const last = dialog.getByText('Produit historique 39', { exact: true });
    await expect(last).toBeAttached(); const initial = (await back.boundingBox())!;
    await last.scrollIntoViewIfNeeded(); await last.click();
    await expect(dialog.getByText('Total', { exact: true })).toBeVisible();
    await expect(back).toBeVisible(); expect((await back.boundingBox())!.y).toBeCloseTo(initial.y, 0);
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    await back.click(); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
    expect(writes).toEqual([]);
  });
}
