import { CapacitorHttp } from '@capacitor/core';
import { extractRecipeFromHtml, type ExtractionMethod, type RecipeDraft } from '../../shared/recipeParsing';
import { isNative } from './platform';

export interface ImportResult {
  recipe: RecipeDraft;
  method: ExtractionMethod;
}

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/**
 * Imports a recipe from a URL. The apps fetch the page natively (no CORS limits, no server needed);
 * the website goes through the /api/import endpoint.
 */
export async function importRecipeFromUrl(url: string): Promise<ImportResult> {
  if (isNative) {
    if (!/^https?:\/\//i.test(url)) throw new Error('Povezava ni veljavna.');
    let res;
    try {
      res = await CapacitorHttp.get({
        url,
        headers: { 'User-Agent': MOBILE_UA, 'Accept-Language': 'sl,en;q=0.8' },
        responseType: 'text',
        connectTimeout: 10_000,
        readTimeout: 10_000,
      });
    } catch {
      throw new Error('Strani ni bilo mogoče naložiti. Preveri internetno povezavo.');
    }
    if (res.status >= 400) throw new Error(`Strani ni bilo mogoče naložiti (HTTP ${res.status}).`);
    const html = typeof res.data === 'string' ? res.data : '';
    return extractRecipeFromHtml(html, res.url || url);
  }

  let res;
  try {
    res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new Error('Strežnik ni dosegljiv.');
  }
  const data = (await res.json().catch(() => ({}))) as Partial<ImportResult> & { error?: string };
  if (!res.ok || !data.recipe || !data.method) throw new Error(data.error ?? 'Uvoz ni uspel.');
  return { recipe: data.recipe, method: data.method };
}

/** First http(s) link in a shared text, e.g. "Check this out! https://www.instagram.com/reel/…". */
export function findUrl(text: string): string | undefined {
  return text.match(/https?:\/\/[^\s"'<>]+/i)?.[0].replace(/[).,!?]+$/, '');
}
