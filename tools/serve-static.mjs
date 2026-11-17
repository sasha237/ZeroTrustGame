// Tiny static file server for packages/client/dist (SPA fallback to index.html).
// Usage: node tools/serve-static.mjs [port]  (default 4178)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? 4178);
const root = fileURLToPath(new URL('../packages/client/dist', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.map': 'application/json',
};

createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (urlPath === '/') urlPath = '/index.html';
    let file = path.join(root, urlPath);
    if (!file.startsWith(root)) throw new Error('path escape');
    let body;
    try {
      body = await readFile(file);
    } catch {
      // SPA fallback: unknown paths serve the app shell (hash routes never hit this,
      // but direct deep links do).
      file = path.join(root, 'index.html');
      body = await readFile(file);
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(port, () => console.log(`[static] serving ${root} on http://localhost:${port}`));
