import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('browser startup failure replaces stale success evidence and exits unsuccessfully', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'vrstore-pages-report-'));
  mkdirSync(join(cwd, '.backups'));
  const path = join(cwd, '.backups/pages-report.json');
  writeFileSync(path, JSON.stringify({ status: 'passed', url: 'https://old.example.invalid/' }));
  const url = 'http://127.0.0.1:9/vrstore/';
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./verify-pages.mjs', import.meta.url))], {
    cwd, env: { ...process.env, PAGES_VERIFY_URL: url, PLAYWRIGHT_CHANNEL: 'vrstore-unsupported-test-channel' },
    encoding: 'utf8', windowsHide: true, timeout: 20000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  const report = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(report.status, 'failed');
  assert.equal(report.url, url);
  assert(Number.isFinite(Date.parse(report.verifiedAt)));
  assert.match(report.error, /channel/i);
  assert.deepEqual(report.checks, []);
});
