// HTTP handlers for /api/*, shared by the Vite dev server and the production server.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { extractRecipeFromHtml } from '../shared/recipeParsing.js';

const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 5;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function isPrivateAddress(address) {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a.startsWith('::ffff:')) return isPrivateAddress(a.slice(7));
    return a === '::1' || a === '::' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80');
  }
  const [a, b] = address.split('.').map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Rejects non-http(s) URLs and hosts that resolve to local or private networks. */
async function assertPublicUrl(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UserError('Podprte so samo povezave http(s).');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (addresses.some(isPrivateAddress)) throw new UserError('Ta naslov ni dovoljen.');
}

class UserError extends Error {}

async function fetchPage(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UserError('Povezava ni veljavna.');
  }

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { 'user-agent': USER_AGENT, 'accept-language': 'sl,en;q=0.8', accept: 'text/html,*/*;q=0.8' },
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw new UserError(`Strani ni bilo mogoče naložiti (HTTP ${res.status}).`);

    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return { html: Buffer.concat(chunks).toString('utf8'), finalUrl: url.toString() };
  }
  throw new UserError('Preveč preusmeritev.');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) reject(new UserError('Zahteva je prevelika.'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new UserError('Neveljaven JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export async function handleApi(req, res) {
  const path = req.url.split('?')[0];
  try {
    if (path === '/api/import' && req.method === 'POST') {
      const { url } = await readJson(req);
      if (typeof url !== 'string' || !url.trim()) throw new UserError('Manjka povezava.');
      const { html, finalUrl } = await fetchPage(url.trim());
      return send(res, 200, extractRecipeFromHtml(html, finalUrl));
    }
    if (path === '/api/health') return send(res, 200, { ok: true });
    send(res, 404, { error: 'Ni najdeno.' });
  } catch (err) {
    if (err instanceof UserError) return send(res, 400, { error: err.message });
    if (err?.code === 'ENOTFOUND') return send(res, 400, { error: 'Te spletne strani ni bilo mogoče najti.' });
    console.error('[api]', err);
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    send(res, 502, { error: timeout ? 'Stran se ni odzvala pravočasno.' : 'Uvoz ni uspel. Poskusi prilepiti besedilo recepta.' });
  }
}
