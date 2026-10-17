const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅕': 1 / 5, '⅖': 2 / 5,
  '⅗': 3 / 5, '⅘': 4 / 5, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
};
const FRAC = `[${Object.keys(UNICODE_FRACTIONS).join('')}]`;
// Order matters: mixed numbers ("1 1/2") before plain fractions and decimals.
const NUM = `(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:[.,]\\d+)?(?:\\s*${FRAC})?|${FRAC})`;

/** Unit aliases (lowercase, without trailing dot) mapped to a canonical key. */
const UNIT_ALIASES: Record<string, string> = {
  g: 'g', gr: 'g', gram: 'g', grams: 'g', gramov: 'g', grama: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  mg: 'mg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  cl: 'cl', dl: 'dl',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l', litra: 'l', litrov: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', žlička: 'tsp', žličke: 'tsp', žličk: 'tsp', čž: 'tsp', kž: 'tsp',
  tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', žlica: 'tbsp', žlice: 'tbsp', žlic: 'tbsp', jž: 'tbsp',
  cup: 'cup', cups: 'cup', skodelica: 'cup', skodelice: 'cup', skodelic: 'cup',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  clove: 'clove', cloves: 'clove', strok: 'clove', stroka: 'clove', stroki: 'clove', strokov: 'clove',
  pinch: 'pinch', ščepec: 'pinch', ščepca: 'pinch', ščepce: 'pinch',
  can: 'can', cans: 'can', pločevinka: 'can', pločevinke: 'can', pločevink: 'can',
  package: 'pkg', packages: 'pkg', pkg: 'pkg', zavitek: 'pkg', zavitka: 'pkg', zavitki: 'pkg', vrečka: 'pkg', vrečke: 'pkg',
  slice: 'slice', slices: 'slice', rezina: 'slice', rezini: 'slice', rezine: 'slice', rezin: 'slice',
  kos: 'piece', kosa: 'piece', kosi: 'piece', kosov: 'piece', piece: 'piece', pieces: 'piece',
  // German
  el: 'tbsp', esslöffel: 'tbsp', tl: 'tsp', teelöffel: 'tsp', tasse: 'cup', tassen: 'cup', prise: 'pinch',
  zehe: 'clove', zehen: 'clove', dose: 'can', dosen: 'can', packung: 'pkg', päckchen: 'pkg', pck: 'pkg',
  scheibe: 'slice', scheiben: 'slice', stück: 'piece', stk: 'piece',
  // Spanish / Portuguese
  cucharada: 'tbsp', cucharadas: 'tbsp', cda: 'tbsp', cdas: 'tbsp', cucharadita: 'tsp', cucharaditas: 'tsp', cdta: 'tsp', cdtas: 'tsp',
  taza: 'cup', tazas: 'cup', pizca: 'pinch', diente: 'clove', dientes: 'clove', lata: 'can', latas: 'can',
  paquete: 'pkg', paquetes: 'pkg', sobre: 'pkg', rebanada: 'slice', rebanadas: 'slice', loncha: 'slice', lonchas: 'slice',
  'colher de sopa': 'tbsp', 'colheres de sopa': 'tbsp', 'colher de chá': 'tsp', 'colheres de chá': 'tsp',
  xícara: 'cup', xícaras: 'cup', chávena: 'cup', chávenas: 'cup', pitada: 'pinch', dente: 'clove', dentes: 'clove',
  pacote: 'pkg', pacotes: 'pkg', fatia: 'slice', fatias: 'slice',
  // French
  'cuillère à soupe': 'tbsp', 'cuillères à soupe': 'tbsp', 'c. à soupe': 'tbsp', 'c. à s.': 'tbsp', cas: 'tbsp',
  'cuillère à café': 'tsp', 'cuillères à café': 'tsp', 'c. à café': 'tsp', 'c. à c.': 'tsp', cac: 'tsp',
  tasses: 'cup', pincée: 'pinch', pincées: 'pinch', gousse: 'clove', gousses: 'clove', boîte: 'can', boîtes: 'can',
  sachet: 'pkg', sachets: 'pkg', tranche: 'slice', tranches: 'slice',
  // Italian
  cucchiaio: 'tbsp', cucchiai: 'tbsp', cucchiaino: 'tsp', cucchiaini: 'tsp', tazza: 'cup', tazze: 'cup',
  pizzico: 'pinch', spicchio: 'clove', spicchi: 'clove', lattina: 'can', lattine: 'can', barattolo: 'can',
  confezione: 'pkg', confezioni: 'pkg', bustina: 'pkg', bustine: 'pkg', fetta: 'slice', fette: 'slice',
  // Croatian
  žličica: 'tsp', žličice: 'tsp', šalica: 'cup', šalice: 'cup', prstohvat: 'pinch',
  češanj: 'clove', češnja: 'clove', češnjeva: 'clove', konzerva: 'can', konzerve: 'can', vrećica: 'pkg', vrećice: 'pkg',
  kriška: 'slice', kriške: 'slice', komad: 'piece', komada: 'piece',
};
const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/[.]/g, '\\.'))
  .join('|');

const INGREDIENT_RE = new RegExp(
  `^\\s*(${NUM})(?:\\s*[-–]\\s*(${NUM}))?\\s*(?:(${UNIT_PATTERN})\\.?(?=[\\s,)]|$))?\\s*(?:(?:of|de|di|del|della)\\s+|d['’])?(.*)$`,
  'iu',
);

export interface ParsedIngredient {
  raw: string;
  quantity?: number;
  quantityMax?: number;
  /** Unit as written in the recipe. */
  unit?: string;
  /** Canonical unit key used to merge grocery items. */
  unitKey?: string;
  name: string;
}

export function isHeading(line: string): boolean {
  return /:\s*$/.test(line.trim());
}

export function parseQuantity(text: string): number | undefined {
  const s = text.trim().replace(',', '.');
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = s.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : undefined;
  m = s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)?\\s*(${FRAC})?$`, 'u'));
  if (m && (m[1] || m[2])) return (m[1] ? Number(m[1]) : 0) + (m[2] ? UNICODE_FRACTIONS[m[2]] : 0);
  return undefined;
}

export function parseIngredient(line: string): ParsedIngredient {
  const raw = line.trim();
  const m = raw.match(INGREDIENT_RE);
  if (!m) return { raw, name: raw };
  const [, qty, qtyMax, unit, rest] = m;
  const quantity = parseQuantity(qty);
  if (quantity === undefined) return { raw, name: raw };
  return {
    raw,
    quantity,
    quantityMax: qtyMax ? parseQuantity(qtyMax) : undefined,
    unit: unit || undefined,
    unitKey: unit ? UNIT_ALIASES[unit.toLowerCase()] : undefined,
    name: rest.trim(),
  };
}

const FRACTION_GLYPHS: [number, string][] = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'],
  [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
];

/** Formats a quantity for display: 1.5 → "1 ½", 0.333 → "⅓", 2.4 → "2,4" (or "2.4"). */
export function formatQuantity(value: number, decimal = ','): string {
  if (value <= 0 || !Number.isFinite(value)) return '0';
  const whole = Math.floor(value);
  const frac = value - whole;
  if (frac < 0.02) return String(whole);
  if (frac > 0.98) return String(whole + 1);
  if (value < 10) {
    const glyph = FRACTION_GLYPHS.find(([v]) => Math.abs(v - frac) < 0.02)?.[1];
    if (glyph) return whole ? `${whole} ${glyph}` : glyph;
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded).replace('.', decimal);
}

/** Rewrites an ingredient line with its quantity multiplied by `factor`. */
export function scaleIngredient(line: string, factor: number, decimal = ','): string {
  if (factor === 1 || isHeading(line)) return line;
  const p = parseIngredient(line);
  if (p.quantity === undefined) return line;
  const qty = formatQuantity(p.quantity * factor, decimal);
  const range = p.quantityMax !== undefined ? `–${formatQuantity(p.quantityMax * factor, decimal)}` : '';
  return [qty + range, p.unit, p.name].filter(Boolean).join(' ');
}
