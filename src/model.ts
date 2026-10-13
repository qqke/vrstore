export interface Store { id: string; name: string; address: string; published: boolean; is_demo?: boolean }
export interface Floor { id: string; store_id: string; name: string; sort_order: number; width: number; depth: number; category: string; published: boolean }
export interface Shelf { id: string; floor_id: string; code: string; category: string; x: number; z: number; width: number; depth: number; rotation: number; levels: number; version: number }
export interface Product { id: string; name_zh: string; name_ja: string; brand: string; spec: string; jan: string; aliases: string[]; category: string; image_url: string | null; color: string }
export interface Location { id: string; product_id: string; shelf_id: string; face: 'A' | 'B'; level: number; section: string; active: boolean; last_verified_at: string; version: number }
export interface AccessPoint { id: string; floor_id: string; group_code: string; kind: 'stairs' | 'elevator' | 'escalator'; label: string; x: number; z: number; connects_to: string[]; direction: 'both' | 'up' | 'down'; available: boolean; accessible: boolean | null }
export interface Catalog { stores: Store[]; floors: Floor[]; shelves: Shelf[]; products: Product[]; locations: Location[]; access_points: AccessPoint[] }

export const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();

export function searchProducts(catalog: Catalog, storeId: string, query: string, category: string) {
  const floors = new Set(catalog.floors.filter(f => f.store_id === storeId && f.published).map(f => f.id));
  const shelves = new Set(catalog.shelves.filter(s => floors.has(s.floor_id)).map(s => s.id));
  const ids = new Set(catalog.locations.filter(l => l.active && shelves.has(l.shelf_id)).map(l => l.product_id));
  const q = normalize(query);
  return catalog.products.filter(p => ids.has(p.id) && (!category || p.category === category))
    .map(p => ({ p, score: !q ? 1 : p.jan === q ? 100 : normalize(p.name_zh) === q || normalize(p.name_ja) === q ? 90 :
      [p.name_zh, p.name_ja, p.brand, p.spec, ...p.aliases].some(v => normalize(v).includes(q)) ? 50 : 0 }))
    .filter(p => p.score > 0).sort((a, b) => b.score - a.score).map(item => item.p);
}

export function productLocations(catalog: Catalog, productId: string, storeId: string) {
  return catalog.locations.filter(l => l.product_id === productId && l.active).flatMap(location => {
    const shelf = catalog.shelves.find(s => s.id === location.shelf_id);
    const floor = catalog.floors.find(f => f.id === shelf?.floor_id && f.store_id === storeId && f.published);
    return shelf && floor ? [{ location, shelf, floor }] : [];
  }).sort((a, b) => a.floor.sort_order - b.floor.sort_order);
}

export function parseLink(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#\/?/, ''));
  return { store: params.get('store'), floor: params.get('floor'), product: params.get('product'), location: params.get('location') };
}

export function isStale(date: string, now = Date.now()) {
  return !Number.isFinite(Date.parse(date)) || now - Date.parse(date) > 7 * 24 * 60 * 60 * 1000;
}

export function validateCatalog(value: unknown): Catalog {
  if (!value || typeof value !== 'object') throw new Error('门店数据格式无效');
  const c = value as Catalog;
  for (const key of ['stores', 'floors', 'shelves', 'products', 'locations', 'access_points'] as const) {
    if (!Array.isArray(c[key]) || c[key].some(row => !row || typeof row.id !== 'string')) throw new Error(`无效的数据表：${key}`);
  }
  if (c.stores.some(s => typeof s.name !== 'string') || c.floors.some(f => !(f.width > 0 && f.depth > 0) || typeof f.name !== 'string') ||
    c.shelves.some(s => ![s.x, s.z, s.rotation, s.width, s.depth].every(Number.isFinite) || s.width <= 0 || s.depth <= 0) ||
    c.products.some(p => typeof p.name_zh !== 'string' || !Array.isArray(p.aliases) || typeof p.jan !== 'string')) throw new Error('门店字段格式无效');
  return c;
}
