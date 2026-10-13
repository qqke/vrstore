import { createClient } from '@supabase/supabase-js';
import { demoCatalog } from './demo';
import { validateCatalog, type Catalog } from './model';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configurationError = Boolean(url) !== Boolean(key) ? 'Supabase 配置不完整，请同时配置 URL 和 publishable key。' : url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) ? '请配置有效的 Supabase HTTPS 项目地址。' : key && !key.startsWith('sb_publishable_') ? '请使用 Supabase publishable key，不能将服务端密钥放入前端。' : '';
export const supabase = url && key && !configurationError ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) : null;
const cacheKey = `tana:catalog:${url || 'demo'}:v1`;
export interface LoadedCatalog { catalog: Catalog; mode: 'demo' | 'live' | 'cached'; cachedAt?: string }

export async function loadCatalog(): Promise<LoadedCatalog> {
  if (configurationError) throw new Error(configurationError);
  if (!supabase) return { catalog: demoCatalog, mode: 'demo' };
  try {
    const names = ['stores', 'floors', 'shelves', 'products', 'product_locations', 'floor_access_points'] as const;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let results;
    try { results = await Promise.all(names.map(name => supabase.from(name).select('*').limit(5000).abortSignal(controller.signal))); }
    finally { clearTimeout(timer); }
    const error = results.find(r => r.error)?.error;
    if (error) throw error;
    if (results.some(r => r.data?.length === 5000)) throw new Error('门店目录超过首版容量，请分页加载后使用。');
    const catalog = validateCatalog({ stores: results[0].data, floors: results[1].data, shelves: results[2].data, products: results[3].data, locations: results[4].data, access_points: results[5].data });
    const savedAt = new Date().toISOString();
    try { localStorage.setItem(cacheKey, JSON.stringify({ catalog, savedAt })); } catch { /* Storage can be unavailable; live data remains usable. */ }
    return { catalog, mode: 'live' };
  } catch (error) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      const age = cached ? Date.now() - Date.parse(cached.savedAt) : NaN;
      if (age >= 0 && age < 7 * 86400000) return { catalog: validateCatalog(cached.catalog), mode: 'cached', cachedAt: cached.savedAt };
    } catch { /* Ignore corrupt or unavailable cache. */ }
    throw new Error(error instanceof Error ? error.message : '无法连接门店数据，请稍后重试。');
  }
}
