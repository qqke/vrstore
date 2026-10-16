import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';

// Read-only acceptance of the existing public demo; never signs in or writes data.
const url = process.env.PAGES_VERIFY_URL || 'https://qqke.github.io/vrstore/';
const report = { verifiedAt: new Date().toISOString(), url, status: 'failed', checks: [], limit: 'Desktop Chrome with mobile emulation; no physical device or field trial.' };
let browser;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const page = await browser.newPage();
  const response = await page.goto(`${url}#store=demo&floor=2f&product=p1&location=l31`);
  assert(response?.ok(), 'Pages document unavailable');
  await expect(page.locator('.app-header')).toHaveCSS('display', 'flex');
  await expect(page.locator('.floor-tabs .active')).toHaveText('2F');
  await expect(page.locator('.position-primary')).toContainText('B01');
  await expect(page.locator('.touch-map-toggle')).toBeVisible();
  await page.reload();
  await expect(page.locator('.floor-tabs .active')).toHaveText('2F');
  await expect(page.getByRole('region', { name: '选中商品位置' })).toContainText('极润保湿化妆水');
  await page.locator('.floor-tabs').getByRole('button', { name: 'B1', exact: true }).click();
  await page.goBack();
  await expect(page.locator('.floor-tabs .active')).toHaveText('2F');
  await page.goForward();
  await expect(page.locator('.floor-tabs .active')).toHaveText('B1');
  await page.getByRole('textbox', { name: '搜索商品' }).fill('安耐晒');
  await expect(page.locator('.product-row')).toHaveCount(1);
  await page.locator('.product-row').click();
  await expect(page.locator('.position-primary')).toContainText('A02');
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await mobile.goto(`${url}#store=demo&floor=1f&product=p1&location=l1`);
  await expect(mobile.locator('.floor-map')).toBeVisible();
  assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
  await expect(mobile.locator('.floor-map')).toHaveCSS('touch-action', 'pan-y');
  await mobile.getByRole('button', { name: '3D', exact: true }).tap();
  await expect(mobile.locator('canvas').or(mobile.getByText('此设备的 3D 地图不可用，已切换为平面图。'))).toBeVisible({ timeout: 20000 });
  if (await mobile.locator('canvas').count()) {
    await mobile.locator('canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    await expect(mobile.getByRole('status')).toContainText('已切换为平面图');
  }
  await page.route('**/rest/v1/**', route => route.abort());
  await page.reload();
  await expect(page.locator('.data-banner')).toContainText('保存的历史数据', { timeout: 20000 });
  report.status = 'passed';
  report.checks = ['subpath assets and stylesheet', 'share deep link', 'reload', 'back/forward', 'alias search', 'mobile viewport and touch default', '3D failure fallback', 'historical catalog cache'];
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  try {
    mkdirSync('.backups', { recursive: true });
    writeFileSync('.backups/pages-report.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser?.close(); }
}
