import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { gunzipSync } from 'node:zlib';

const image = process.argv[2];
assert.ok(image, 'Pass the Docker image to test');
const container = `dashboard-ci-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();

try {
  docker('run', '--detach', '--name', container, '--publish', '127.0.0.1::80', image);
  docker('exec', container, 'nginx', '-t');
  const base = `http://${docker('port', container, '80/tcp')}/`;
  let response;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      response = await fetch(base, { signal: AbortSignal.timeout(2000) });
      if (response.ok) break;
    } catch {
      // Nginx may still be starting.
    }
    await setTimeout(500);
  }
  assert.equal(response?.status, 200, 'Container must serve the home page');
  assert.match(response.headers.get('cache-control') ?? '', /no-cache/);
  const html = await response.text();
  assert.match(html, /<div id="app"/);
  const files = docker('exec', container, 'find', '/usr/share/nginx/html/assets', '-type', 'f')
    .split(/\r?\n/).map((path) => path.replace('/usr/share/nginx/html/', ''));
  assert.ok(files.some((path) => /data-worker-.*\.js$/.test(path)), 'Worker must be packaged');
  assert.ok(files.some((path) => /survey\.csv-.*\.gz$/.test(path)), 'Survey data must be packaged');
  for (const match of html.matchAll(/(?:src|href)="(\.\/assets\/[^" ]+)"/g)) {
    assert.ok(files.includes(match[1].slice(2)), `Missing page asset ${match[1]}`);
  }
  for (const path of files) {
    const asset = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000) });
    assert.equal(asset.status, 200, `Asset must be served: ${path}`);
    assert.match(asset.headers.get('cache-control') ?? '', /immutable/);
    const bytes = Buffer.from(await asset.arrayBuffer());
    assert.ok(bytes.length > 0, `Asset must not be empty: ${path}`);
    if (path.endsWith('.gz')) assert.ok(gunzipSync(bytes).length > 0, 'Survey gzip must be valid');
    if (path.endsWith('.js')) assert.match(asset.headers.get('content-type') ?? '', /javascript/);
  }
  const missing = await fetch(new URL('assets/missing.js', base), { signal: AbortSignal.timeout(2000) });
  assert.equal(missing.status, 404, 'Missing assets must not return HTML');
  console.log('Container home page, assets, worker and compressed survey checks passed');
} catch (error) {
  try { console.error(docker('logs', container)); } catch { /* Container may not exist. */ }
  throw error;
} finally {
  try { docker('rm', '--force', container); } catch { /* Preserve the original failure. */ }
}
