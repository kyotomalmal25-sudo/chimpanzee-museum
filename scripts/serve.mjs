// Local preview with SPA fallback (same behaviour as Cloudflare Pages).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = resolve(root, '.' + pathname);
  const blocked = !file.startsWith(root + sep) || /\/(\.git|node_modules|scripts|tests)\//.test(pathname);
  try {
    if (blocked || !extname(pathname)) throw 0;
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(body);
  } catch {
    if (extname(pathname) && !blocked) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime['.html'] }); res.end(await readFile(resolve(root, 'index.html')));
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
