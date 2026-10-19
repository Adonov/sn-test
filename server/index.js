// Production server: serves the built app from dist/ and the /api endpoints.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.js';

// Load ANTHROPIC_API_KEY etc. from .env when present (Node 20.12+).
try {
  process.loadEnvFile?.(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // No .env file: rely on the real environment.
}

const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT) || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(DIST, pathname));
  if (!file.startsWith(DIST)) {
    res.statusCode = 403;
    return res.end();
  }
  const info = await stat(file).catch(() => null);
  if (!info || info.isDirectory()) file = join(DIST, 'index.html');

  const body = await readFile(file);
  res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
  if (file.includes(`${DIST}/assets/`)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  res.end(body);
}

createServer((req, res) => {
  if (req.url.startsWith('/api/')) return handleApi(req, res);
  serveStatic(req, res).catch((err) => {
    console.error(err);
    res.statusCode = 500;
    res.end('Napaka strežnika');
  });
}).listen(PORT, () => console.log(`Forkful runs at http://localhost:${PORT}`));
