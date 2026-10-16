import { test, expect } from '@playwright/test';
import { demoCatalog } from '../src/demo';
import { writeFileSync } from 'node:fs';

async function logIn(page: import('@playwright/test').Page) {
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'admin-test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', aud: 'authenticated' })).toString('base64url'), 'demo-signature'].join('.');
  await page.route('https://demo-test.supabase.co/auth/v1/**', route => route.fulfill({ json: { access_token: token, refresh_token: 'fake-refresh', expires_in: 3600, token_type: 'bearer', user } }));
  await page.goto('/#admin');
  await page.getByLabel('邮箱', { exact: true }).fill(user.email);
  await page.getByLabel('密码', { exact: true }).fill('fake-test-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
}

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
  await page.getByRole('button',{name:'恢复全层视图'}).click();
  await expect(page.locator('.map-shelf.selected')).toHaveCount(0);
  await page.getByRole('button',{name:'2F · B01',exact:true}).click();
  await expect(page.locator('.map-shelf.selected')).toHaveCount(1);
  await page.screenshot({ path:'test-results/preview-desktop.png',fullPage:true });
  await page.locator('.map-shelf[aria-label="B04 护肤货架"]').click();
  await expect(page.getByRole('status')).toContainText('还没有已发布的商品位置');
  await expect(page).not.toHaveURL(/product=/);
});

test('invalid positions and empty searches are explicit', async ({ page }) => {
  await page.goto('/#store=demo&floor=2f&product=missing');
  await expect(page.getByRole('status')).toContainText('不可用');
  await page.getByRole('textbox', { name: '搜索商品' }).fill('不存在的商品');
  await expect(page.getByText('暂时没有找到')).toBeVisible();
  await page.getByRole('button', { name: '查看全部商品', exact: true }).click();
  await expect(page.locator('.product-row')).toHaveCount(30);
});

test('inactive products disappear from search and old location links', async ({ page }) => {
  await page.route('https://demo-test.supabase.co/rest/v1/products*', route => route.fulfill({ json: demoCatalog.products.map(p => ({ ...p, active: p.id !== 'p1' })) }));
  await page.goto('/#store=demo&floor=1f&product=p1&location=l1');
  await expect(page.getByRole('status')).toContainText('分享的位置已下线或不可用');
  await expect(page.locator('.product-row')).toHaveCount(29);
  await expect(page.getByRole('region', { name: '选中商品位置' })).toHaveCount(0);
  await page.getByRole('textbox', { name: '搜索商品' }).fill('极润');
  await expect(page.getByText('暂时没有找到')).toBeVisible();
});

test('missing photos fall back; fast floor changes keep the current map consistent', async ({ page }) => {
  await page.route('https://demo-test.supabase.co/rest/v1/products*', route => route.fulfill({ json: demoCatalog.products.map(p => ({ ...p, image_url: 'https://images.example.invalid/missing.webp' })) }));
  await page.route('https://images.example.invalid/**', route => route.abort());
  await page.goto('/#store=demo&floor=1f&product=p1');
  await expect(page.locator('.detail-art').getByRole('img')).toHaveAttribute('aria-label', /包装示意/);
  for (const floor of ['2F', 'B1', '1F', '2F']) await page.locator('.floor-tabs').getByRole('button', { name: floor, exact: true }).click();
  await expect(page.locator('.floor-tabs .active')).toHaveText('2F');
  await expect(page.locator('.floor-map')).toHaveAttribute('aria-label', /^2F/);
  await expect(page.getByRole('region', { name: '选中商品位置' })).toContainText('极润保湿化妆水');
  await expect(page.locator('.map-shelf')).toHaveCount(8);
  await expect(page.locator('.map-shelf.selected')).toHaveCount(0);
  const failAPI = (route: import('@playwright/test').Route) => route.abort();
  await page.route('https://demo-test.supabase.co/rest/v1/**', failAPI);
  await page.reload();
  await expect(page.locator('.data-banner')).toContainText('保存的历史数据', { timeout: 20000 });
  await expect(page.locator('.detail-art').getByRole('img')).toHaveAttribute('aria-label', /包装示意/);
  await page.unroute('https://demo-test.supabase.co/rest/v1/**', failAPI);
  const png = await page.evaluate(() => document.createElement('canvas').toDataURL('image/png').split(',')[1]);
  await page.route('https://images.example.invalid/restored.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }));
  await page.route('https://demo-test.supabase.co/rest/v1/products*', route => route.fulfill({ json: demoCatalog.products.map(p => ({ ...p, image_url: 'https://images.example.invalid/restored.png' })) }));
  await page.getByRole('button', { name: '重试连接', exact: true }).click();
  await expect(page.locator('.detail-art img')).toHaveAttribute('src', 'https://images.example.invalid/restored.png');
});

test('ten virtual pickup journeys resolve the expected floor, shelf face and level', async ({ page }, testInfo) => {
  const journeys = [
    ['安耐晒', 'p2', '1F', 'A02', 'B', '2'],
    ['極潤', 'p1', '1F', 'A01', 'A', '1'],
    ['0490000000007', 'p7', '1F', 'B03', 'A', '3'],
    ['pair', 'p8', '1F', 'B04', 'B', '4'],
    ['ＫＡＴＥ', 'p13', '2F', 'A01', 'A', '1'],
    ['睫毛夹', 'p18', '2F', 'A02', 'B', '2'],
    ['BOTANIST', 'p19', 'B1', 'A03', 'A', '3'],
    ['ＤＨＣ', 'p25', 'B1', 'B01', 'A', '1'],
    ['胶原蛋白', 'p27', 'B1', 'B03', 'A', '3'],
    ['宝矿力', 'p30', 'B1', 'B02', 'B', '2'],
  ];
  const results = [];
  for (const [query, id, floor, shelf, face, level] of journeys) {
    await page.goto('/');
    const started = Date.now();
    await page.getByRole('textbox', { name: '搜索商品' }).fill(query);
    const product = demoCatalog.products.find(p => p.id === id)!;
    await page.locator('.product-row').filter({ has: page.getByText(product.name_zh, { exact: true }) }).click();
    const detail = page.getByRole('region', { name: '选中商品位置' });
    await expect(detail.locator('.position-primary')).toContainText(floor);
    await expect(detail.locator('.position-primary')).toContainText(shelf);
    await expect(detail).toContainText(`第 ${level} 层`);
    await expect(detail).toContainText(`${face} 面`);
    results.push({ query, product: product.name_zh, floor, shelf, face, level, elapsedMs: Date.now() - started, result: 'passed', kind: 'automated virtual journey; not a human field trial' });
  }
  const report = testInfo.outputPath('virtual-pickups.json');
  writeFileSync(report, JSON.stringify(results, null, 2));
  await testInfo.attach('virtual-pickups.json', { path: report, contentType: 'application/json' });
});

test('maps show facility direction, stops and closure; 2D can pan and reset', async ({ page }) => {
  await page.route('https://demo-test.supabase.co/rest/v1/floor_access_points*', route => route.fulfill({ json: demoCatalog.access_points.map(p => p.floor_id === '1f' ? { ...p, direction: 'up', connects_to: ['2f'], available: false } : p) }));
  await page.goto('/');
  await expect(page.locator('.access-strip')).toContainText('仅上行 · 2F · 暂时停用');
  await expect(page.locator('.floor-map')).toContainText('仅上行 · 2F · 暂时停用');
  const map = page.locator('.floor-map');
  const original = await map.getAttribute('viewBox');
  await page.getByRole('button', { name: '放大地图', exact: true }).click();
  const zoomed = await map.getAttribute('viewBox');
  expect(zoomed).not.toBe(original);
  const bounds = (await map.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * .8);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 70, bounds.y + bounds.height * .8 - 30, { steps: 5 });
  await page.mouse.up();
  expect(await map.getAttribute('viewBox')).not.toBe(zoomed);
  await page.getByRole('button', { name: '恢复全层视图' }).click();
  await expect(map).toHaveAttribute('viewBox', original!);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas').or(page.getByText('此设备的 3D 地图不可用，已切换为平面图。'))).toBeVisible({ timeout: 20000 });
  if (await page.locator('canvas').count()) await expect(page.locator('.three-access').filter({ hasText: '电梯' })).toContainText('仅上行 · 2F · 暂时停用');
});

test.describe('touch map gestures', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('page remains scrollable until map interaction is explicitly enabled', async ({ page }) => {
    await page.goto('/#store=demo&floor=1f&product=p1');
    const map = page.locator('.floor-map');
    await expect(map).toBeVisible();
    await map.scrollIntoViewIfNeeded();
    await expect(map).toHaveCSS('touch-action', 'pan-y');
    const bounds = (await map.boundingBox())!;
    const before = await page.evaluate(() => window.scrollY);
    const session = await page.context().newCDPSession(page);
    const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 6; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 20 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    await page.getByRole('button', { name: '拖动地图', exact: true }).tap();
    await expect(map).toHaveCSS('touch-action', 'none');
    await page.getByRole('button', { name: '允许页面滚动', exact: true }).tap();
    await expect(map).toHaveCSS('touch-action', 'pan-y');
    await page.getByRole('button', { name: '3D', exact: true }).tap();
    await expect(page.locator('canvas').or(page.getByText('此设备的 3D 地图不可用，已切换为平面图。'))).toBeVisible({ timeout: 20000 });
    if (await page.locator('canvas').count()) {
      await expect(page.locator('canvas')).toHaveCSS('pointer-events', 'none');
      await page.getByRole('button', { name: '操作 3D 地图', exact: true }).tap();
      await expect(page.locator('canvas')).toHaveCSS('pointer-events', 'auto');
      await page.getByRole('button', { name: '允许页面滚动', exact: true }).tap();
      await expect(page.locator('canvas')).toHaveCSS('pointer-events', 'none');
    }
  });
});

test('real store warns about stale positions and clears warning for recent verification', async ({ page }) => {
  await page.route('https://demo-test.supabase.co/rest/v1/stores*', route => route.fulfill({ json: demoCatalog.stores.map(s => ({ ...s, is_demo: false })) }));
  await page.route('https://demo-test.supabase.co/rest/v1/product_locations*', route => route.fulfill({ json: demoCatalog.locations.map(l => ({ ...l, last_verified_at: l.id === 'l31' ? new Date().toISOString() : '2020-01-01T00:00:00Z' })) }));
  await page.goto('/#store=demo&floor=1f&product=p1');
  const detail = page.getByRole('region', { name: '选中商品位置' });
  await expect(detail.getByRole('status')).toContainText('超过 7 天未核实');
  await page.getByRole('button', { name: '2F · B01', exact: true }).click();
  await expect(detail).toContainText('位置已核实');
  await expect(detail.getByRole('status')).toHaveCount(0);
});

test('mobile layout has no horizontal overflow and floor changes work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.floor-tabs')).toBeVisible();
  await page.locator('.floor-tabs').getByRole('button', { name: 'B1', exact: true }).click();
  await expect(page.locator('.floor-tabs .active')).toHaveText('B1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('.product-row').first().click();
  await expect(page.locator('.floor-tabs .active')).toHaveText('1F');
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(200);
  await page.screenshot({ path:'test-results/preview-mobile.png',fullPage:true });
});

test('slow catalog responses show loading and then recover without fake empty results', async ({ page }) => {
  await page.route('https://demo-test.supabase.co/rest/v1/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 750));
    await route.fallback();
  });
  await page.goto('/');
  await expect(page.getByText('正在展开店铺地图…', { exact: true })).toBeVisible();
  await expect(page.locator('.product-row')).toHaveCount(30);
  await expect(page.getByText('暂时没有找到', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: '搜索商品' }).fill('安耐晒');
  await expect(page.locator('.product-row')).toHaveCount(1);
});

for (const failure of ['network', 'HTTP 503']) {
test(`${failure} failure uses clearly labeled historical cache`, async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.product-row')).toHaveCount(30);
  await page.route('https://demo-test.supabase.co/rest/v1/**', route => failure === 'network' ? route.abort() : route.fulfill({ status: 503, json: { message: 'Service unavailable' } }));
  await page.reload();
  await expect(page.locator('.data-banner')).toContainText('保存的历史数据',{timeout:18000});
  await expect(page.locator('.demo-badge')).toHaveText('历史数据');
  await expect(page.locator('.product-row')).toHaveCount(30);
});
}

test('first access with failed network never displays a fake empty store', async ({page}) => {
  await page.route('https://demo-test.supabase.co/rest/v1/**', route=>route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'暂时无法读取门店'})).toBeVisible({timeout:18000});
  await expect(page.getByRole('button',{name:'重新加载'})).toBeVisible();
});

test('local management retains edits on version conflicts', async ({page}) => {
  await logIn(page);
  await expect(page.getByText('授权门店：demo',{exact:false})).toBeVisible();
  await page.locator('.admin-tabs').getByRole('button',{name:'商品',exact:true}).click();
  await page.locator('.admin-records').getByRole('button').filter({hasText:'极润保湿化妆水'}).click();
  await page.getByLabel('中文名',{exact:false}).fill('修改尚未保存');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('记录已被他人修改或权限已撤销');
  await expect(page.getByLabel('中文名',{exact:false})).toHaveValue('修改尚未保存');
  const imageURL=page.getByLabel('图片 URL',{exact:false});
  const previousURL=await imageURL.inputValue();
  await page.getByLabel('上传商品图片').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
  await expect(page.getByRole('status')).toContainText('JPG / PNG / WebP');
  await page.getByLabel('上传商品图片').setInputFiles({name:'oversize.png',mimeType:'image/png',buffer:Buffer.alloc(12*1024*1024+1)});
  await expect(page.getByRole('status')).toContainText('不超过 12MB');
  await expect(imageURL).toHaveValue(previousURL);
  const png=await page.evaluate(()=>document.createElement('canvas').toDataURL('image/png').split(',')[1]);
  await page.route('https://demo-test.supabase.co/storage/v1/object/product-images/**',route=>route.fulfill({status:403,json:{statusCode:'403',error:'Unauthorized',message:'Upload denied'}}));
  await page.getByLabel('上传商品图片').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await expect(page.getByRole('status')).toContainText('Upload denied');
  await expect(imageURL).toHaveValue(previousURL);
  await page.route('https://demo-test.supabase.co/storage/v1/object/product-images/**',async route=>{
    expect(route.request().postDataBuffer()!.toString('latin1')).toContain('Content-Type: image/webp');
    expect(route.request().url()).toMatch(/product-images\/demo\/[0-9a-f-]+\.webp$/);
    await route.fulfill({json:{Key:'demo/test.webp'}});
  });
  await page.getByLabel('上传商品图片').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await expect(page.getByRole('status')).toContainText('图片已上传，请保存商品');
  await expect(imageURL).toHaveValue(/\/object\/public\/product-images\/demo\/[0-9a-f-]+\.webp$/);
  await expect(page.getByLabel('中文名',{exact:false})).toHaveValue('修改尚未保存');
});

for (const failure of ['no grant', 'grant read error'] as const) {
  test(`management clears previous access after ${failure}`, async ({ page }) => {
    await logIn(page);
    await expect(page.locator('.admin-records').getByRole('button')).toHaveCount(31);
    await page.route('https://demo-test.supabase.co/rest/v1/store_admins*', route => failure === 'no grant'
      ? route.fulfill({ json: [] })
      : route.fulfill({ status: 403, json: { message: 'Permission denied' } }));
    const writes: string[] = [];
    page.on('request', request => { if (request.url().includes('/rest/v1/') && request.method() !== 'GET') writes.push(request.url()); });
    await page.locator('.admin-tabs').getByRole('button', { name: '商品', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(failure === 'no grant' ? '没有门店管理权限' : '加载失败');
    await expect(page.getByText('授权门店：无', { exact: false })).toBeVisible();
    await expect(page.locator('.admin-records').getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '新增', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '检查并预览' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
    expect(writes).toEqual([]);
  });
}

test('3D map either renders or falls back with a clear explanation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas').or(page.getByText('此设备的 3D 地图不可用，已切换为平面图。'))).toBeVisible({ timeout: 20000 });
  if (await page.locator('canvas').count()) {
    const oldCanvas=await page.locator('canvas').elementHandle();
    await page.locator('.floor-tabs').getByRole('button',{name:'2F',exact:true}).click();
    await expect(page.locator('.floor-tabs .active')).toHaveText('2F');
    await expect.poll(() => oldCanvas!.evaluate(canvas => canvas.isConnected)).toBe(false);
    await expect(page.locator('.three-label')).toHaveCount(8);
    await expect(page.locator('.three-label[aria-label="B01 护肤货架"]')).toBeVisible();
    await oldCanvas!.evaluate(canvas=>canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
    await expect(page.getByRole('button',{name:'3D',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.locator('canvas').evaluate(canvas=>canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
    await expect(page.getByRole('status')).toContainText('已切换为平面图');
    await expect(page.locator('.floor-map')).toBeVisible();
  }
});

test('desktop 3D camera rotates, zooms and returns to a fresh full-floor view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const canvas = page.locator('canvas');
  await expect(canvas.or(page.getByText('此设备的 3D 地图不可用，已切换为平面图。'))).toBeVisible({ timeout: 20000 });
  if (!await canvas.count()) return;
  await expect(page.locator('.three-label')).toHaveCount(8);
  const before = await canvas.screenshot();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 20, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 90, bounds.y + 50, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  const rotated = await canvas.screenshot();
  await page.mouse.wheel(0, 180);
  await expect.poll(async () => (await canvas.screenshot()).equals(rotated)).toBe(false);
  const oldCanvas = await canvas.elementHandle();
  await page.getByRole('button', { name: '恢复全层视图' }).click();
  expect(await oldCanvas!.evaluate(element => element.isConnected)).toBe(false);
  await expect(page.locator('.three-label')).toHaveCount(8);
});
