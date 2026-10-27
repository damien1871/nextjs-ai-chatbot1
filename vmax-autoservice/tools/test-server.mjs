// Lokaler Testserver für dist/: setzt exakt die Header aus public/.htaccess (ohne HSTS-Wirkung auf http://localhost).
//   node tools/test-server.mjs [port]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const port = Number(process.argv[2] ?? 4321);
const root = new URL('../dist/', import.meta.url).pathname;
const htaccess = readFileSync(new URL('../public/.htaccess', import.meta.url), 'utf8');
const headers = {};
for (const m of htaccess.matchAll(/^\s*Header always set (\S+) "(.*)"\s*$/gm)) headers[m[1]] = m[2];

const typen = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.avif': 'image/avif', '.webp': 'image/webp',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let pfad = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let datei = join(root, pfad);
  if (existsSync(datei) && statSync(datei).isDirectory()) {
    if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' }); return res.end(); }
    datei = join(datei, 'index.html');
  }
  const gefunden = existsSync(datei);
  const ziel = gefunden ? datei : join(root, '404.html');
  const h = { ...headers, 'Content-Type': typen[extname(ziel)] ?? 'application/octet-stream' };
  if (url.pathname.startsWith('/_astro/')) h['Cache-Control'] = 'public, max-age=31536000, immutable';
  res.writeHead(gefunden ? 200 : 404, h);
  res.end(readFileSync(ziel));
}).listen(port, '127.0.0.1', () => console.log(`Testserver: http://localhost:${port}`));
