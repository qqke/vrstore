import { writeFileSync } from 'node:fs';
import { demoCatalog } from '../src/demo.ts';

const literal = v => v === null ? 'null' : typeof v === 'boolean' || typeof v === 'number' ? String(v) : Array.isArray(v) ? `array[${v.map(literal).join(',')}]::text[]` : `'${String(v).replaceAll("'", "''")}'`;
const tables = [
  ['stores', demoCatalog.stores], ['floors', demoCatalog.floors], ['shelves', demoCatalog.shelves],
  ['products', demoCatalog.products.map(p => ({ ...p, store_id: 'demo' }))],
  ['product_locations', demoCatalog.locations], ['floor_access_points', demoCatalog.access_points],
];
let sql = '-- Fictional demonstration only. Never represents a real store or real JAN codes.\nbegin;\n';
for (const [table, rows] of tables) for (const row of rows) {
  const fields = Object.keys(row);
  sql += `insert into public.${table} (${fields.join(',')}) values (${fields.map(f => literal(row[f])).join(',')}) on conflict (id) do nothing;\n`;
}
sql += 'commit;\n';
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log(`Generated seed: ${tables.reduce((sum, [, rows]) => sum + rows.length, 0)} demo records.`);
