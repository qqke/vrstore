import { describe, expect, it } from 'vitest';
import { demoCatalog } from './demo';
import { accessDescription, isStale, normalize, parseLink, productLocations, searchProducts, validateCatalog } from './model';

describe('catalog search and location integrity', () => {
  it('describes direction, public stops, accessibility and closed facilities consistently', () => {
    const point = { ...demoCatalog.access_points[0], direction: 'up' as const, available: false };
    const floors = demoCatalog.floors.map(f => ({ ...f, published: f.id !== 'b1' }));
    expect(accessDescription(point, floors)).toBe('仅上行 · 1F / 2F · 暂时停用 · 无障碍');
    expect(accessDescription({ ...point, connects_to: ['missing'], direction: 'down', accessible: null }, floors)).toBe('仅下行 · 无公开连接 · 暂时停用 · 无障碍未知');
  });
  it('finds leading-zero barcodes exactly and prioritizes them', () => {
    const catalog = { ...demoCatalog, products: demoCatalog.products.map((p, i) => ({ ...p, jan: i === 0 ? '0012345678905' : p.jan, aliases: [...p.aliases, '0012345678905'] })) };
    expect(searchProducts(catalog, 'demo', '００１２３４５６７８９０５', '')[0].id).toBe('p1');
    expect(catalog.products[0].jan).toBe('0012345678905');
    expect(searchProducts({ ...catalog, products: catalog.products.map(p => ({ ...p, aliases: [] })) }, 'demo', '12345678905', '')).toEqual([]);
  });
  it('distinguishes similar products by specification', () => {
    const original = demoCatalog.products[0];
    const catalog = { ...demoCatalog, products: [{ ...original, spec: '170ml' }, { ...original, id: 'refill', spec: '140ml 替换装' }], locations: [...demoCatalog.locations, { ...demoCatalog.locations[0], id: 'refill-location', product_id: 'refill' }] };
    expect(searchProducts(catalog, 'demo', '１４０ｍｌ', '').map(p => p.id)).toEqual(['refill']);
    expect(searchProducts(catalog, 'demo', '170ml', '').map(p => p.id)).toEqual([original.id]);
  });
  it('marks verification older than seven days as stale', () => {
    const verified = '2026-10-01T00:00:00+09:00';
    const boundary = Date.parse(verified) + 7 * 24 * 60 * 60 * 1000;
    expect(isStale(verified, boundary)).toBe(false);
    expect(isStale(verified, boundary + 1)).toBe(true);
    expect(isStale('', boundary)).toBe(true);
  });
  it('supports Chinese aliases, Japanese names and full-width input', () => {
    expect(searchProducts(demoCatalog, 'demo', '安耐晒', '')[0].id).toBe('p2');
    expect(searchProducts(demoCatalog, 'demo', '極潤', '')[0].id).toBe('p1');
    expect(normalize(' ＤＨＣ　 ')).toBe('dhc');
  });
  it('keeps multiple floors and excludes unpublished floors', () => {
    expect(productLocations(demoCatalog, 'p1', 'demo').map(p => p.floor.name)).toEqual(['1F', '2F']);
    const privateFloor = { ...demoCatalog, floors: demoCatalog.floors.map(f => ({ ...f, published: f.id !== '2f' })) };
    expect(productLocations(privateFloor, 'p1', 'demo')).toHaveLength(1);
    expect(searchProducts(privateFloor, 'demo', '', '彩妆')).toHaveLength(0);
  });
  it('does not expose other stores or inactive positions', () => {
    expect(searchProducts(demoCatalog, 'another-store', '', '')).toEqual([]);
    expect(productLocations({ ...demoCatalog, locations: demoCatalog.locations.map(l => ({ ...l, active: false })) }, 'p1', 'demo')).toEqual([]);
    const inactive = { ...demoCatalog, products: demoCatalog.products.map(p => ({ ...p, active: false })) };
    expect(searchProducts(inactive, 'demo', '', '')).toEqual([]);
    expect(productLocations(inactive, 'p1', 'demo')).toEqual([]);
  });
  it('handles empty results, share links, invalid timestamps and cache data', () => {
    expect(searchProducts(demoCatalog, 'demo', '不存在商品', '')).toEqual([]);
    expect(parseLink('#store=demo&floor=2f&product=p1&location=l31').floor).toBe('2f');
    expect(isStale('bad')).toBe(true);
    expect(isStale('2026-10-13', Date.parse('2026-10-14'))).toBe(false);
    expect(() => validateCatalog({})).toThrow();
    expect(() => validateCatalog({ ...demoCatalog, floors: [{ ...demoCatalog.floors[0], width: -1 }] })).toThrow();
    expect(() => validateCatalog({ ...demoCatalog, products: demoCatalog.products.map(p => ({ ...p, active: 'false' })) })).toThrow();
    expect(validateCatalog(demoCatalog)).toBe(demoCatalog);
  });
});
