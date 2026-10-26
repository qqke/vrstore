import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { backupImages } from './backup-images.mjs';

const tables = ['stores', 'floors', 'shelves', 'products', 'product_locations', 'floor_access_points', 'store_admins'];

export async function saveChangeBackup(snapshot, inventory, destination) {
  for (const table of tables) assert(Array.isArray(snapshot[table]), `Missing table: ${table}`);
  assert.equal(inventory.bucket, 'product-images');
  assert(inventory.capturedAt && Array.isArray(inventory.objects), 'Missing trusted Storage inventory');
  await mkdir(destination, { mode: 0o700 });
  const files = {};
  for (const [name, value] of Object.entries({ 'catalog.json': { capturedAt: inventory.capturedAt, tables: snapshot }, 'storage-inventory.json': inventory })) {
    const bytes = JSON.stringify(value, null, 2);
    await writeFile(join(destination, name), bytes, { flag: 'wx', mode: 0o600 });
    files[name] = createHash('sha256').update(bytes).digest('hex');
  }
  const images = await backupImages(inventory, join(destination, 'images'));
  const imageManifest = await readFile(join(destination, 'images', 'manifest.json'));
  files['images/manifest.json'] = createHash('sha256').update(imageManifest).digest('hex');
  const manifest = { capturedAt: inventory.capturedAt, completedAt: new Date().toISOString(), projectUrl: images.projectUrl, files, counts: Object.fromEntries(tables.map(t => [t, snapshot[t].length])), images: images.objects.length, limitations: 'Application data and product-images only; excludes Auth, roles and platform configuration. Keep private; copy off-device separately.' };
  await writeFile(join(destination, 'complete.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // Never accept a connection string on the command line, where credentials can enter process logs.
  assert(process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE, 'Configure PGHOST, PGUSER, PGDATABASE and local PostgreSQL password authentication first');
  assert(['require', 'verify-ca', 'verify-full'].includes(process.env.PGSSLMODE), 'Set PGSSLMODE=require or stricter');
  const project = new URL(process.env.VITE_SUPABASE_URL);
  assert.equal(project.origin, 'https://snwmlrzyljmipqopefzi.supabase.co', 'This command is restricted to vrstore');
  assert(process.env.PGHOST === 'db.snwmlrzyljmipqopefzi.supabase.co' || (process.env.PGHOST.endsWith('.pooler.supabase.com') && process.env.PGUSER === 'postgres.snwmlrzyljmipqopefzi'), 'Database connection must target vrstore');
  const catalogSql = await readFile(new URL('../supabase/backup-catalog.sql', import.meta.url), 'utf8');
  const storageSql = await readFile(new URL('../supabase/backup-storage-index.sql', import.meta.url), 'utf8');
  let output;
  try {
    output = execFileSync(process.env.PSQL_BIN || 'psql', ['-X', '-q', '-A', '-t', '-w', '-v', 'ON_ERROR_STOP=1'], { input: `begin isolation level repeatable read read only;\n${catalogSql}\n${storageSql}\ncommit;`, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    // Child-process errors include captured stdout, which may contain private records.
    throw new Error('Database backup read failed. Check local connection, authentication and read permissions; no completed backup was created.');
  }
  const lines = output.trim().split(/\r?\n/);
  assert.equal(lines.length, 2, 'Expected complete catalog and Storage inventory');
  const [snapshot, inventory] = lines.map(line => JSON.parse(line));
  inventory.projectUrl = project.origin;
  await mkdir('.backups', { recursive: true, mode: 0o700 });
  const destination = join('.backups', `before-change-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const result = await saveChangeBackup(snapshot, inventory, destination);
  console.log(`Backup complete: ${destination}; ${result.images} images. Keep this directory private.`);
}
