import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoCatalog } from '../src/demo.ts';

// Auth and Storage SQL contracts are emulated; this does not test their HTTP services.
const root = fileURLToPath(new URL('../', import.meta.url));
const bin = process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '');
const port = process.env.RESTORE_PG_PORT || '55432';
assert(/^\d+$/.test(port), 'Invalid local PostgreSQL port');
const database = `vrstore_restore_${Date.now()}`;
const connection = ['-h', '127.0.0.1', '-p', port, '-U', 'postgres'];
const run = (command, args, input) => execFileSync(join(bin, command + (process.platform === 'win32' ? '.exe' : '')), [...connection, ...args], { input, encoding: 'utf8', windowsHide: true });
const sql = query => run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-d', database, '-At'], query);
const install = ['schema.sql', 'hardening.sql', 'finite-layout.sql', 'protect-floor-links.sql', 'update-timestamps.sql', 'protect-access-points.sql'];
const tables = ['stores', 'floors', 'shelves', 'products', 'product_locations', 'floor_access_points', 'store_admins'];
const demo = process.argv.includes('--demo');
const snapshot = demo ? {
  stores: demoCatalog.stores, floors: demoCatalog.floors, shelves: demoCatalog.shelves,
  products: demoCatalog.products.map(p => ({ ...p, store_id: 'demo' })),
  product_locations: demoCatalog.locations, floor_access_points: demoCatalog.access_points, store_admins: [],
} : JSON.parse(readFileSync(join(root, '.backups/catalog.json'), 'utf8')).tables;
for (const name of tables) assert(Array.isArray(snapshot[name]), `Missing ${name}`);
run('createdb', [database]);
try {
  sql(readFileSync(join(root, 'supabase/local-test-bootstrap.sql'), 'utf8'));
  for (const name of install) sql(readFileSync(join(root, 'supabase', name), 'utf8'));
  for (const name of readdirSync(join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).sort()) sql(readFileSync(join(root, 'supabase/migrations', name), 'utf8'));
  const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const userIds = [...new Set(snapshot.store_admins.map(row => row.user_id))];
  sql(`insert into auth.users(id) select value::uuid from jsonb_array_elements_text(${literal(userIds)});`);
  for (const name of tables) {
    const rows = snapshot[name];
    if (rows.length) {
      const fields = Object.keys(rows[0]);
      assert(fields.every(field => /^[a-z_]+$/.test(field)), 'Invalid snapshot field');
      sql(`insert into public.${name} (${fields.join(',')}) select ${fields.join(',')} from jsonb_populate_recordset(null::public.${name},${literal(rows)});`);
    }
    assert.equal(Number(sql(`select count(*) from public.${name};`).trim()), snapshot[name].length, `${name} restore count`);
  }
  sql(readFileSync(join(root, 'supabase/verify-permissions.sql'), 'utf8'));
  sql(readFileSync(join(root, 'supabase/verify-layout.sql'), 'utf8'));
  sql(readFileSync(join(root, 'supabase/verify-product-active.sql'), 'utf8'));
  assert.equal(Number(sql("select count(*) from auth.users where email like '%test@example.invalid';").trim()), 0, 'Test users must roll back');
  const report = { verifiedAt: new Date().toISOString(), source: demo ? 'virtual demonstration tables' : 'private application-table snapshot', tables: Object.fromEntries(tables.map(name => [name, snapshot[name].length])), permissions: 'passed', layout: 'passed', productDeactivationAndPublication: 'passed', limits: 'Local PostgreSQL; Auth passwords and Storage HTTP service are not restored.' };
  mkdirSync(join(root, '.backups'), { recursive: true });
  writeFileSync(join(root, '.backups/restore-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  assert(/^vrstore_restore_\d+$/.test(database));
  run('dropdb', [database]);
}
