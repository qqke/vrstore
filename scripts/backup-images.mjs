import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function backupImages(inventory, destination) {
  const project = new URL(inventory.projectUrl || process.env.VITE_SUPABASE_URL);
  assert(project.protocol === 'https:' || project.hostname === '127.0.0.1', 'Use HTTPS for remote storage');
  assert(Array.isArray(inventory.objects), 'Provide a complete, trusted Storage object inventory');
  assert.equal(new Set(inventory.objects.map(o => o.name)).size, inventory.objects.length, 'Duplicate object name');
  await mkdir(destination); // Refuse to overwrite an existing backup, including a partial one.
  const objects = [];
  for (const object of inventory.objects) {
    assert(typeof object.name === 'string' && object.name.split('/').every(part => part && part !== '.' && part !== '..' && !/[\\\x00]/.test(part)), 'Invalid storage object name');
    const response = await fetch(new URL(`/storage/v1/object/public/product-images/${object.name.split('/').map(encodeURIComponent).join('/')}`, project), { signal: AbortSignal.timeout(15000) });
    assert(response.ok, `Image download failed: ${object.name} (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (object.size !== undefined) assert.equal(bytes.length, object.size, `Image size changed: ${object.name}`);
    const file = `${digest(object.name)}.bin`;
    await writeFile(join(destination, file), bytes, { flag: 'wx', mode: 0o600 });
    objects.push({ name: object.name, file, size: bytes.length, sha256: digest(bytes), contentType: response.headers.get('content-type') });
  }
  const manifest = { capturedAt: new Date().toISOString(), projectUrl: project.origin, bucket: 'product-images', objects };
  await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  return manifest;
}

export async function restoreImages(source, destination) {
  const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
  assert.equal(manifest.bucket, 'product-images');
  assert(Array.isArray(manifest.objects));
  const names = new Set();
  // Validate the complete backup before creating any restored files.
  for (const object of manifest.objects) {
    assert(typeof object.file === 'string' && /^[a-f0-9]{64}\.bin$/.test(object.file), 'Invalid backup file name');
    assert(!names.has(object.name), 'Duplicate restored object'); names.add(object.name);
    const bytes = await readFile(join(source, object.file));
    assert.equal(digest(bytes), object.sha256, `Corrupt image backup: ${object.name}`);
    assert.equal(bytes.length, object.size, `Image size mismatch: ${object.name}`);
  }
  await mkdir(destination);
  for (const object of manifest.objects) await writeFile(join(destination, object.file), await readFile(join(source, object.file)), { flag: 'wx', mode: 0o600 });
  await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, source, destination] = process.argv.slice(2);
  assert(['backup', 'restore'].includes(mode) && source && destination, 'Usage: node scripts/backup-images.mjs backup INVENTORY OUTPUT | restore BACKUP OUTPUT');
  const manifest = mode === 'backup' ? await backupImages(JSON.parse(await readFile(source, 'utf8')), destination) : await restoreImages(source, destination);
  console.log(`${mode}: ${manifest.objects.length} image files verified. Local restore does not upload to Supabase.`);
}
