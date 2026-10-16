import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupImages, restoreImages } from './backup-images.mjs';

test('backs up actual image bytes and restores them; refuses corruption and overwrite', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');
  const server = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'image/png' }); res.end(png); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const root = await mkdtemp(join(tmpdir(), 'vrstore-image-restore-'));
  try {
    const inventory = { projectUrl: `http://127.0.0.1:${server.address().port}`, objects: [{ name: 'demo/虚拟商品.png', size: png.length }] };
    const manifest = await backupImages(inventory, join(root, 'backup'));
    const restored = await restoreImages(join(root, 'backup'), join(root, 'restored'));
    assert.deepEqual(restored, manifest);
    assert.deepEqual(await readFile(join(root, 'restored', manifest.objects[0].file)), png);
    await assert.rejects(backupImages(inventory, join(root, 'backup')), /EEXIST/);
    await writeFile(join(root, 'backup', manifest.objects[0].file), 'corrupted');
    await assert.rejects(restoreImages(join(root, 'backup'), join(root, 'corrupt-restore')), /Corrupt image backup/);
    await assert.rejects(backupImages({ ...inventory, objects: [{ name: '../escape.png' }] }, join(root, 'invalid')), /Invalid storage/);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('failed downloads never produce a completed manifest', async () => {
  const server = createServer((_req, res) => { res.writeHead(404); res.end(); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const root = await mkdtemp(join(tmpdir(), 'vrstore-image-failure-'));
  try {
    await assert.rejects(backupImages({ projectUrl: `http://127.0.0.1:${server.address().port}`, objects: [{ name: 'demo/missing.png' }] }, join(root, 'partial')), /download failed/);
    await assert.rejects(readFile(join(root, 'partial/manifest.json')), /ENOENT/);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
