export interface Field { key: string; label: string; type?: 'number' | 'boolean' | 'list' | 'datetime' }
export const entities: Record<string, { label: string; fields: Field[] }> = {
  stores: { label: '门店', fields: [{ key: 'name', label: '名称' }, { key: 'address', label: '地址' }, { key: 'published', label: '发布', type: 'boolean' }, { key: 'is_demo', label: '演示门店', type: 'boolean' }] },
  floors: { label: '楼层', fields: [{ key: 'store_id', label: '门店 ID' }, { key: 'name', label: '楼层名称' }, { key: 'sort_order', label: '排序', type: 'number' }, { key: 'width', label: '宽度（米）', type: 'number' }, { key: 'depth', label: '深度（米）', type: 'number' }, { key: 'category', label: '类别说明' }, { key: 'published', label: '发布', type: 'boolean' }] },
  shelves: { label: '货架', fields: [{ key: 'floor_id', label: '楼层 ID' }, { key: 'code', label: '编号' }, { key: 'category', label: '类别' }, ...['x','z','width','depth','rotation','levels'].map(key => ({ key, label: ({ x:'X 坐标',z:'Z 坐标',width:'宽度',depth:'深度',rotation:'旋转角度',levels:'总层数' } as Record<string,string>)[key], type: 'number' as const }))] },
  products: { label: '商品', fields: [{ key: 'store_id', label: '门店 ID' }, { key: 'name_zh', label: '中文名' }, { key: 'name_ja', label: '日文名' }, { key: 'brand', label: '品牌' }, { key: 'spec', label: '规格' }, { key: 'jan', label: 'JAN 条码（字符串）' }, { key: 'aliases', label: '搜索别名（用 | 分隔）', type: 'list' }, { key: 'category', label: '分类' }, { key: 'image_url', label: '图片 URL' }, { key: 'color', label: '缺图示意颜色' }] },
  product_locations: { label: '商品位置', fields: [{ key: 'product_id', label: '商品 ID' }, { key: 'shelf_id', label: '货架 ID' }, { key: 'face', label: 'A / B 面' }, { key: 'level', label: '从下往上层数', type: 'number' }, { key: 'section', label: '区域' }, { key: 'active', label: '有效', type: 'boolean' }, { key: 'last_verified_at', label: '现场核实时间（ISO，含时区）', type: 'datetime' }] },
  floor_access_points: { label: '楼层连接', fields: [{ key: 'floor_id', label: '楼层 ID' }, { key: 'group_code', label: '设施连接组' }, { key: 'kind', label: 'stairs / elevator / escalator' }, { key: 'label', label: '显示名称' }, { key: 'x', label: 'X 坐标', type: 'number' }, { key: 'z', label: 'Z 坐标', type: 'number' }, { key: 'connects_to', label: '目标楼层 ID（用 | 分隔）', type: 'list' }, { key: 'direction', label: 'both / up / down' }, { key: 'available', label: '开放', type: 'boolean' }, { key: 'accessible', label: '无障碍 true / false / 空值' }] },
};

export function parseField(field: Field, value: string): unknown {
  if (field.type === 'number') { if (!value.trim() || !Number.isFinite(Number(value))) throw new Error(`${field.label}需要数字`); return Number(value); }
  if (field.type === 'boolean') { if (value !== 'true' && value !== 'false') throw new Error(`${field.label}需要 true / false`); return value === 'true'; }
  if (field.type === 'list') return value.split('|').map(s => s.trim()).filter(Boolean);
  if (field.type === 'datetime') { if (!/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`${field.label}需要带时区的 ISO 日期`); return new Date(value).toISOString(); }
  if (field.key === 'accessible') { if (!value) return null; if (value !== 'true' && value !== 'false') throw new Error('无障碍状态需要 true / false / 空值'); return value === 'true'; }
  if (field.key === 'image_url') { if (!value) return null; if (!/^https:\/\//.test(value)) throw new Error('图片需要 HTTPS 地址'); }
  return value;
}

export function parseCSV(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else if (quoted || !cell) quoted = !quoted; else throw new Error('CSV 引号位置无效'); }
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(c => c.trim())) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (quoted) throw new Error('CSV 引号未闭合');
  row.push(cell); if (row.some(c => c.trim())) rows.push(row);
  return rows;
}

export function importCSV(table: string, input: string) {
  const fields = entities[table]?.fields;
  if (!fields || table === 'stores') throw new Error('不支持导入此表');
  const [headers, ...rows] = parseCSV(input);
  if (!headers || !headers.includes('id') || new Set(headers).size !== headers.length || headers.some(h => h !== 'id' && !fields.some(f => f.key === h))) throw new Error('CSV 表头必须包含 id，且使用页面显示的字段名称');
  if (!rows.length || rows.length > 200) throw new Error('每次导入 1～200 行');
  const records = rows.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`第 ${i + 2} 行列数不一致`);
    return Object.fromEntries(headers.map((h, n) => [h, h === 'id' ? values[n] : parseField(fields.find(f => f.key === h)!, values[n])]));
  });
  if (records.some(r => !r.id) || new Set(records.map(r => r.id)).size !== records.length) throw new Error('ID 不能为空或重复');
  return records;
}
