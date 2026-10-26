import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveChangeBackup } from './backup-before-change.mjs';

test('change backup requires all tables, preserves previous backups and marks completion last', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vrstore-change-backup-'));
  const snapshot = Object.fromEntries(['stores', 'floors', 'shelves', 'products', 'product_locations', 'floor_access_points', 'store_admins'].map(t => [t, []]));
  const inventory = { bucket: 'product-images', capturedAt: new Date().toISOString(), projectUrl: 'https://snwmlrzyljmipqopefzi.supabase.co', objects: [] };
  const destination = join(root, 'complete');
  const result = await saveChangeBackup(snapshot, inventory, destination);
  assert.equal(result.images, 0);
  assert.deepEqual(JSON.parse(await readFile(join(destination, 'catalog.json'), 'utf8')).tables, snapshot);
  for (const [name, hash] of Object.entries(result.files)) assert.equal(createHash('sha256').update(await readFile(join(destination, name))).digest('hex'), hash);
  assert.deepEqual(JSON.parse(await readFile(join(destination, 'complete.json'), 'utf8')), result);
  await assert.rejects(saveChangeBackup(snapshot, inventory, destination), /EEXIST/);
  await assert.rejects(saveChangeBackup({}, inventory, join(root, 'missing')), /Missing table/);
  const partial = join(root, 'partial');
  await assert.rejects(saveChangeBackup(snapshot, { ...inventory, objects: [{ name: '../invalid.png' }] }, partial), /Invalid storage object/);
  await assert.rejects(readFile(join(partial, 'complete.json')), /ENOENT/);
});
