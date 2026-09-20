import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const artifacts = join(root, 'tests/.artifacts');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function build(name, env = {}) {
  const output = join(artifacts, name);
  const result = spawnSync(npm, ['run', 'build', '--', '--outDir', output], {
    cwd: root,
    env: { ...process.env, PUBLIC_WEB3FORMS_ACCESS_KEY: '', ...env },
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

mkdirSync(artifacts, { recursive: true });
build('default');
build('configured', { PUBLIC_WEB3FORMS_ACCESS_KEY: 'playwright-fake-access-key' });

const mime = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png',
};

function serve(directory, port) {
  return createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const candidate = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    let file = normalize(join(directory, candidate));
    if (!file.startsWith(`${directory}${sep}`)) {
      response.writeHead(403).end(); return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(directory, '404.html');
    if (!existsSync(file)) { response.writeHead(404).end(); return; }
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(readFileSync(file));
  }).listen(port, '127.0.0.1');
}

const servers = [serve(join(artifacts, 'default'), 4173), serve(join(artifacts, 'configured'), 4174)];
const close = () => Promise.all(servers.map((server) => new Promise((done) => server.close(done))));
process.on('SIGINT', async () => { await close(); process.exit(0); });
process.on('SIGTERM', async () => { await close(); process.exit(0); });
