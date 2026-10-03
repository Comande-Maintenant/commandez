import { test, expect } from '@playwright/test';
test('the first merchant guide stays visible above the mobile navigation', async ({ page }) => {
  await page.goto('/admin/demo?lang=fr');
  const next = page.getByRole('button', { name: 'Suivant', exact: true });
  await expect(next).toBeVisible();
  const target = await page.locator('[data-tour=cuisine]:visible').first().boundingBox();
  const mask = await page.locator('div[style*="mask-image"]').first().evaluate(el => (el as HTMLElement).style.maskImage);
  const center = mask.match(/at ([\d.]+)px ([\d.]+)px/);
  expect(center).not.toBeNull();
  expect(Number(center![2])).toBeCloseTo(target!.y + target!.height / 2, 0);
  const box = await next.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});
