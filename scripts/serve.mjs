// Servidor estático mínimo para previsualizar dist/ sin dependencias.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = join(process.cwd(), 'dist');
const PORT = Number(process.env.PORT || 4321);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain',
};

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {}
  let status = 200;
  let body;
  try {
    body = await readFile(file);
  } catch {
    status = 404;
    file = join(DIST, '404.html');
    body = await readFile(file);
  }
  const headers = { 'content-type': TYPES[extname(file)] || 'application/octet-stream' };
  if (/gzip/.test(req.headers['accept-encoding'] || '')) {
    body = gzipSync(body);
    headers['content-encoding'] = 'gzip';
  }
  res.writeHead(status, headers).end(body);
}).listen(PORT, () => console.log(`Vista previa en http://localhost:${PORT}`));
