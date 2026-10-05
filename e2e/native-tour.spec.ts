import { test, expect } from '@playwright/test';
test('the first actionable demo guide leaves navigation accessible', async ({ page }) => {
  await page.goto('/admin/demo?lang=fr',{waitUntil:'networkidle'});
  const receive = page.getByRole('button', { name: 'Recevoir une commande', exact: true });
  await expect(receive).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator('div[style*="mask-image"]')).toHaveCount(0);
  const box = await receive.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  const nav=page.locator('[data-dashboard-nav]');
  if(await nav.count()) { const navBox=await nav.boundingBox();if(navBox && navBox.width>navBox.height)expect(box!.y+box!.height).toBeLessThanOrEqual(navBox.y); }
});
