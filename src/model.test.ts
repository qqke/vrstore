import { describe, expect, it } from 'vitest';
import { demoCatalog } from './demo';
import { isStale, normalize, parseLink, productLocations, searchProducts, validateCatalog } from './model';

describe('catalog search and location integrity', () => {
  it('finds leading-zero barcodes exactly and prioritizes them', () => {
    expect(searchProducts(demoCatalog, 'demo', demoCatalog.products[0].jan, '')[0].id).toBe('p1');
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
  });
  it('handles empty results, share links, invalid timestamps and cache data', () => {
    expect(searchProducts(demoCatalog, 'demo', '不存在商品', '')).toEqual([]);
    expect(parseLink('#store=demo&floor=2f&product=p1&location=l31').floor).toBe('2f');
    expect(isStale('bad')).toBe(true);
    expect(isStale('2026-10-13', Date.parse('2026-10-14'))).toBe(false);
    expect(() => validateCatalog({})).toThrow();
    expect(() => validateCatalog({ ...demoCatalog, floors: [{ ...demoCatalog.floors[0], width: -1 }] })).toThrow();
    expect(validateCatalog(demoCatalog)).toBe(demoCatalog);
  });
});
