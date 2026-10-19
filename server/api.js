// HTTP handlers for /api/*, shared by the Vite dev server and the production server.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import Anthropic from '@anthropic-ai/sdk';
import { extractRecipeFromHtml } from '../shared/recipeParsing.js';
import { estimateFoods, estimateRecipe, NutritionError } from './nutrition.js';
import { readRecipe, TranslateError, translateRecipe } from './translate.js';

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
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UserError('invalid_url');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (addresses.some(isPrivateAddress)) throw new UserError('not_allowed');
}

/** An expected failure; `message` is an error code the app translates (see "error.*" UI strings). */
class UserError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.params = params;
  }
}

async function fetchPage(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UserError('invalid_url');
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
    if (!res.ok) throw new UserError('http', { status: res.status });

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
  throw new UserError('too_many_redirects');
}

// AI requests (translations, nutrition estimates) cost money per call, so each client address gets a modest budget, and the
// whole server a daily cap (MAX_TRANSLATIONS_PER_DAY) so a flood of requests can't run up the bill.
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT = 60;
const DAILY_LIMIT = Number(process.env.MAX_AI_REQUESTS_PER_DAY ?? process.env.MAX_TRANSLATIONS_PER_DAY) || 300;
const hits = new Map();
let today = '';
let translatedToday = 0;

/** The caller's address. Behind a proxy (Render, Railway…) set TRUST_PROXY=1 to read X-Forwarded-For. */
function clientAddress(req) {
  const forwarded = process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] ?? '') : '';
  // The proxy appends the address it saw, so the last entry is the one that can't be spoofed.
  return forwarded.split(',').pop().trim() || req.socket.remoteAddress || 'unknown';
}

function rateLimited(req) {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== today) {
    today = day;
    translatedToday = 0;
    hits.clear();
  }
  if (translatedToday >= DAILY_LIMIT) return true;
  const key = clientAddress(req);
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (recent.length > RATE_LIMIT) return true;
  translatedToday++;
  return false;
}

function readJson(req, maxBytes = 50_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBytes) reject(new UserError('failed'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new UserError('failed'));
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
  // The iOS/Android apps call the API from capacitor://localhost or https://localhost.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  try {
    if (path === '/api/translate' && req.method === 'POST') {
      if (rateLimited(req)) return send(res, 429, { error: 'rate_limited' });
      const { recipe, targetLanguage } = await readJson(req);
      return send(res, 200, { recipe: await translateRecipe(readRecipe(recipe), targetLanguage) });
    }
    if (path === '/api/nutrition/estimate' && req.method === 'POST') {
      if (rateLimited(req)) return send(res, 429, { error: 'rate_limited' });
      // Meal photos arrive as data URLs (downscaled by the app), hence the larger limit.
      const { image, text, lang } = await readJson(req, 5_000_000);
      return send(res, 200, { items: await estimateFoods({ image, text, lang }) });
    }
    if (path === '/api/nutrition/recipe' && req.method === 'POST') {
      if (rateLimited(req)) return send(res, 429, { error: 'rate_limited' });
      const { recipe } = await readJson(req);
      return send(res, 200, { perServing: await estimateRecipe(recipe) });
    }
    if (path === '/api/import' && req.method === 'POST') {
      const { url } = await readJson(req);
      if (typeof url !== 'string' || !url.trim()) throw new UserError('invalid_url');
      const { html, finalUrl } = await fetchPage(url.trim());
      return send(res, 200, extractRecipeFromHtml(html, finalUrl));
    }
    if (path === '/api/health') return send(res, 200, { ok: true });
    send(res, 404, { error: 'not_found' });
  } catch (err) {
    if (err instanceof UserError) return send(res, 400, { error: err.message, ...err.params });
    if (err instanceof TranslateError || err instanceof NutritionError) {
      return send(res, err.message === 'not_configured' ? 503 : 422, { error: err.message });
    }
    if (err instanceof Anthropic.AuthenticationError) return send(res, 503, { error: 'not_configured' });
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'rate_limited' });
    if (err?.code === 'ENOTFOUND') return send(res, 400, { error: 'not_found' });
    console.error('[api]', err);
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    send(res, 502, { error: timeout ? 'timeout' : 'failed' });
  }
}
