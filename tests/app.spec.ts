import { test, expect } from '@playwright/test';

test('search, cross-floor location and sharing survive reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('这是虚构门店与包装示意', { exact: false })).toBeVisible();
  await page.getByRole('textbox', { name: '搜索商品' }).fill('安耐晒');
  await expect(page.locator('.product-row')).toHaveCount(1);
  await page.locator('.product-row').click();
  await expect(page.getByRole('region', { name: '选中商品位置' })).toContainText('安热沙防晒乳');
  await page.getByRole('textbox', { name: '搜索商品' }).fill('极润');
  await page.locator('.product-row').click();
  await page.getByRole('button', { name: '2F · B01', exact: true }).click();
  await expect(page.locator('.floor-tabs .active')).toHaveText('2F');
  await expect(page.locator('.map-shelf.selected')).toHaveAttribute('aria-label', 'B01 护肤货架');
  await page.reload();
  await expect(page.locator('.floor-tabs .active')).toHaveText('2F');
  await expect(page.getByRole('region', { name: '选中商品位置' })).toContainText('极润保湿化妆水');
});

test('invalid positions and empty searches are explicit', async ({ page }) => {
  await page.goto('/#store=demo&floor=2f&product=missing');
  await expect(page.getByRole('status')).toContainText('不可用');
  await page.getByRole('textbox', { name: '搜索商品' }).fill('不存在的商品');
  await expect(page.getByText('暂时没有找到')).toBeVisible();
  await page.getByRole('button', { name: '查看全部商品', exact: true }).click();
  await expect(page.locator('.product-row')).toHaveCount(30);
});

test('mobile layout has no horizontal overflow and floor changes work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.floor-tabs')).toBeVisible();
  await page.locator('.floor-tabs').getByRole('button', { name: 'B1', exact: true }).click();
  await expect(page.locator('.floor-tabs .active')).toHaveText('B1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('3D map either renders or falls back with a clear explanation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas').or(page.getByText('此设备的 3D 地图不可用，已切换为平面图。'))).toBeVisible({ timeout: 20000 });
});
