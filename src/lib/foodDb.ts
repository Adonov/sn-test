import { CapacitorHttp } from '@capacitor/core';
import { parseOffNutriments, type Nutrients } from './nutrition';
import { isNative } from './platform';

/** A packaged food from Open Food Facts (openfoodfacts.org, open data, no key needed). */
export interface FoodProduct {
  barcode?: string;
  name: string;
  brand?: string;
  image?: string;
  /** Nutrients per 1 g (or 1 ml). */
  perGram: Nutrients;
  /** Grams in one serving, when the package states it. */
  servingGrams?: number;
}

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,brands,nutriments,serving_quantity,image_front_small_url';

async function getJson(url: string): Promise<unknown> {
  if (isNative) {
    const res = await CapacitorHttp.get({ url, headers: { 'User-Agent': 'tAIsty/1.0 (recipe app)' } });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  }
  const res = await fetch(url);
  if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface OffProduct {
  code?: string;
  product_name?: string;
  [key: `product_name_${string}`]: string | undefined;
  brands?: string;
  nutriments?: Record<string, unknown>;
  serving_quantity?: number | string;
  image_front_small_url?: string;
}

export function toProduct(p: OffProduct, lang: string): FoodProduct | undefined {
  const name = (p[`product_name_${lang}`] || p.product_name || '').trim();
  const perGram = parseOffNutriments(p.nutriments);
  if (!name || perGram.kcal === undefined) return undefined;
  const serving = Number(p.serving_quantity);
  return {
    barcode: p.code,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    image: p.image_front_small_url,
    perGram,
    servingGrams: Number.isFinite(serving) && serving > 0 ? serving : undefined,
  };
}

export async function lookupBarcode(barcode: string, lang: string): Promise<FoodProduct | undefined> {
  const code = barcode.replace(/\D/g, '');
  if (!code) return undefined;
  const data = (await getJson(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS},product_name_${lang}`)) as {
    status?: number;
    product?: OffProduct;
  };
  return data.status === 1 && data.product ? toProduct({ ...data.product, code }, lang) : undefined;
}

export async function searchFoods(query: string, lang: string): Promise<FoodProduct[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '25',
    lc: lang,
    fields: `${FIELDS},product_name_${lang}`,
  });
  const data = (await getJson(`${BASE}/cgi/search.pl?${params}`)) as { products?: OffProduct[] };
  return (data.products ?? []).map((p) => toProduct(p, lang)).filter((p): p is FoodProduct => Boolean(p));
}
