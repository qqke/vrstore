import { test, expect } from '@playwright/test';
import { demoCatalog } from '../src/demo';

test.beforeEach(async ({page}) => {
  await page.route('https://demo-test.supabase.co/rest/v1/**', async route => {
    const table=new URL(route.request().url()).pathname.split('/').pop()!;
    const data: Record<string,unknown> = { ...demoCatalog, products:demoCatalog.products.map(p=>({...p,store_id:'demo',version:1})), product_locations:demoCatalog.locations, floor_access_points:demoCatalog.access_points, store_admins:[{user_id:'00000000-0000-4000-8000-000000000001',store_id:'demo'}] };
    if (route.request().method()==='PATCH') await route.fulfill({json:[]});
    else await route.fulfill({json:data[table] || []});
  });
});

test('search, cross-floor location and sharing survive reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('这是虚构门店与包装示意', { exact: false })).toBeVisible();
  await expect(page.locator('.map-shelf.selected')).toHaveCount(0);
  await page.getByRole('textbox', { name: '搜索商品' }).fill('安耐晒');
  await expect(page.locator('.product-row')).toHaveCount(1);
  await page.locator('.product-row').click();
  await expect(page.getByRole('region', { name: '选中商品位置' })).toContainText('安热沙防晒乳');
  await page.getByRole('textbox', { name: '搜索商品' }).fill('极润');
  await page.locator('.product-row').click();
  await page.getByRole('button', { name: '2F · B01', exact: true }).click();
  await expect(page.locator('.floor-tabs .active')).toHaveText('2F');
  await expect(page.locator('.map-shelf.selected')).toHaveAttribute('aria-label', 'B01 护肤货架');
  await expect(page.locator('.map-shelf.selected line[aria-label="目标 A 面"]')).toHaveCount(1);
  const before=await page.locator('.floor-map').getAttribute('viewBox');
  await page.getByRole('button',{name:'放大地图',exact:true}).click();
  expect(await page.locator('.floor-map').getAttribute('viewBox')).not.toEqual(before);
  await page.reload();
  await expect(page.locator('.floor-tabs .active')).toHaveText('2F');
  await expect(page.getByRole('region', { name: '选中商品位置' })).toContainText('极润保湿化妆水');
  await page.screenshot({ path:'test-results/preview-desktop.png',fullPage:true });
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
  await page.screenshot({ path:'test-results/preview-mobile.png',fullPage:true });
});

test('network failure uses clearly labeled historical cache', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.product-row')).toHaveCount(30);
  await page.route('https://demo-test.supabase.co/rest/v1/**', route=>route.abort());
  await page.reload();
  await expect(page.locator('.data-banner')).toContainText('保存的历史数据',{timeout:18000});
  await expect(page.locator('.demo-badge')).toHaveText('历史数据');
  await expect(page.locator('.product-row')).toHaveCount(30);
});

test('first access with failed network never displays a fake empty store', async ({page}) => {
  await page.route('https://demo-test.supabase.co/rest/v1/**', route=>route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'暂时无法读取门店'})).toBeVisible({timeout:18000});
  await expect(page.getByRole('button',{name:'重新加载'})).toBeVisible();
});

test('local management retains edits on version conflicts', async ({page}) => {
  const user={id:'00000000-0000-4000-8000-000000000001',email:'admin-test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
  const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',aud:'authenticated'})).toString('base64url'),'demo-signature'].join('.');
  await page.route('https://demo-test.supabase.co/auth/v1/**', route=>route.fulfill({json:{access_token:token,refresh_token:'fake-refresh',expires_in:3600,token_type:'bearer',user}}));
  await page.goto('/#admin');
  await page.getByLabel('邮箱',{exact:true}).fill(user.email);
  await page.getByLabel('密码',{exact:true}).fill('fake-test-password');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByText('授权门店：demo',{exact:false})).toBeVisible();
  await page.locator('.admin-tabs').getByRole('button',{name:'商品',exact:true}).click();
  await page.locator('.admin-records').getByRole('button').filter({hasText:'极润保湿化妆水'}).click();
  await page.getByLabel('中文名',{exact:false}).fill('修改尚未保存');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('记录已被他人修改或权限已撤销');
  await expect(page.getByLabel('中文名',{exact:false})).toHaveValue('修改尚未保存');
});

test('3D map either renders or falls back with a clear explanation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas').or(page.getByText('此设备的 3D 地图不可用，已切换为平面图。'))).toBeVisible({ timeout: 20000 });
});
