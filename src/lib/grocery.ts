import { formatQuantity, isHeading, parseIngredient } from './ingredients';
import type { GroceryItem } from './types';

export const CATEGORIES = [
  'Sadje in zelenjava',
  'Meso in ribe',
  'Mlečni izdelki in jajca',
  'Kruh in pekovski izdelki',
  'Shramba',
  'Začimbe in omake',
  'Zamrznjeno',
  'Pijače',
  'Drugo',
] as const;

// Keywords match the start of a word ("paradižnik" matches "paradižniki").
// A trailing "=" means the whole word must match exactly ("sol=" does not match "solata").
const KEYWORDS: [string, string[]][] = [
  ['Začimbe in omake', [
    'sol=', 'soli=', 'salt=', 'poper', 'black pepper', 'pepper flakes', 'cimet', 'cinnamon', 'paprika v prahu',
    'kumin', 'cumin', 'origano', 'oregano', 'bazilika suh', 'timijan', 'thyme', 'rožmarin', 'rosemary', 'kurkum',
    'turmeric', 'curry', 'kari', 'muškatn', 'nutmeg', 'vanilij', 'vanilla', 'ketchup', 'kečap', 'gorčic', 'mustard',
    'majonez', 'mayo', 'sojin', 'soy sauce', 'kis=', 'kisa=', 'vinegar', 'sriracha', 'pesto', 'chili', 'čili', 'lovorov',
    'bay leaf', 'začimb', 'spice', 'vegeta',
  ]],
  ['Sadje in zelenjava', [
    'paradižnik', 'tomat', 'čebul', 'onion', 'shallot', 'česen', 'česna', 'garlic', 'krompir', 'potato', 'korenj',
    'carrot', 'paprik', 'bell pepper', 'kumar', 'cucumber', 'solat', 'lettuce', 'špinač', 'spinach', 'bučk', 'zucchini',
    'buč', 'pumpkin', 'jajčevec', 'eggplant', 'brokol', 'broccoli', 'cvetač', 'cauliflower', 'zelje', 'cabbage',
    'gob', 'mushroom', 'šampinjon', 'por=', 'leek', 'zelen', 'celery', 'avokad', 'avocado', 'limon', 'lemon',
    'lime', 'limet', 'jabolk', 'apple', 'banan', 'jagod', 'strawberr', 'borovnic', 'blueberr', 'malin', 'raspberr',
    'pomaranč', 'orange', 'grozdj', 'grape', 'hrušk', 'pear', 'breskev', 'peach', 'mang', 'ananas', 'pineapple',
    'peteršilj', 'parsley', 'koriander', 'cilantro', 'meta', 'mint', 'bazilik', 'basil', 'drobnjak', 'chive',
    'ingver', 'ginger', 'rukol', 'arugula', 'koruz', 'corn=', 'grah', 'peas', 'stročj', 'green bean', 'redkvic',
    'rdeča pesa', 'beet', 'sladki krompir', 'sweet potato', 'kale', 'ohrovt', 'mladi luk', 'spring onion', 'scallion',
  ]],
  ['Meso in ribe', [
    'piščan', 'piščanč', 'chicken', 'puran', 'turkey', 'govej', 'govedin', 'beef', 'svinj', 'pork', 'mlet',
    'ground', 'slanin', 'bacon', 'pršut', 'prosciutto', 'šunk', 'ham', 'klobas', 'sausage', 'salam', 'jagnj', 'lamb',
    'teleti', 'veal', 'losos', 'salmon', 'tun', 'tuna', 'riba', 'ribe', 'fish', 'kozic', 'shrimp', 'prawn', 'oslič',
    'cod', 'file', 'zrezek', 'steak', 'čevapčič',
  ]],
  ['Mlečni izdelki in jajca', [
    'mlek', 'milk', 'jajc', 'jajca', 'egg', 'maslo', 'masla', 'butter', 'smetan', 'cream', 'jogurt', 'yogurt',
    'yoghurt', 'sir=', 'sira=', 'siri=', 'cheese', 'parmezan', 'parmesan', 'mozzarel', 'skut', 'ricotta', 'feta', 'mascarpone',
    'kisla smetana', 'sour cream', 'kefir', 'cottage',
  ]],
  ['Kruh in pekovski izdelki', [
    'kruh', 'bread', 'toast', 'žemlj', 'bun', 'tortilj', 'tortilla', 'pita', 'bageta', 'baguette', 'listnato',
    'puff pastry', 'testo za', 'krušne drobtine', 'breadcrumb', 'drobtin',
  ]],
  ['Zamrznjeno', ['zamrznjen', 'frozen', 'sladoled', 'ice cream']],
  ['Pijače', ['vino', 'wine', 'pivo', 'beer', 'sok=', 'juice', 'kava', 'coffee', 'čaj', 'tea=', 'mineraln', 'voda=', 'water=']],
  ['Shramba', [
    'mok', 'flour', 'sladkor', 'sugar', 'riž', 'rice', 'testenin', 'pasta', 'špaget', 'spaghetti', 'njok', 'olje',
    'oil', 'olivno', 'kvas', 'yeast', 'pecilni', 'baking', 'soda bikarbon', 'med=', 'medu=', 'honey', 'čokolad',
    'chocolate', 'kakav', 'cocoa', 'oves', 'ovsen', 'oat', 'oreh', 'walnut', 'mandlj', 'almond', 'lešnik', 'hazelnut',
    'arašid', 'peanut', 'fižol', 'bean', 'čičeriko', 'čičerik', 'chickpea', 'leč', 'lentil', 'kuskus', 'couscous',
    'kvinoj', 'quinoa', 'jušn', 'broth', 'stock', 'paradižnikova mezga', 'pelat', 'passata', 'tomato paste',
    'kokosov', 'coconut', 'rozin', 'raisin', 'semen', 'seed', 'polent', 'zdrob', 'škrob', 'cornstarch', 'želatin',
  ]],
];

const PRECOMPILED = KEYWORDS.map(([category, words]) => ({
  category,
  phrases: words.filter((w) => w.includes(' ')),
  exact: words.filter((w) => w.endsWith('=')).map((w) => w.slice(0, -1)),
  prefixes: words.filter((w) => !w.includes(' ') && !w.endsWith('=')),
}));

export function categorize(name: string): string {
  const text = name.toLowerCase();
  const words = text.split(/[^\p{L}]+/u).filter(Boolean);
  for (const { category, phrases, exact, prefixes } of PRECOMPILED) {
    if (
      phrases.some((p) => text.includes(p)) ||
      exact.some((e) => words.includes(e)) ||
      prefixes.some((p) => words.some((w) => w.startsWith(p)))
    ) {
      return category;
    }
  }
  return 'Drugo';
}

/** Strips preparation notes so "čebula, drobno sesekljana" and "čebula" merge. */
export function normalizeName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, '')
    .split(/,| - | – /)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

// Metric units are converted to a base unit so "500 g" and "1 kg" add up.
const BASE_UNITS: Record<string, [string, number]> = {
  mg: ['g', 0.001], g: ['g', 1], kg: ['g', 1000],
  ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000],
};

function toBase(quantity: number | undefined, unitKey: string | undefined, unit: string | undefined) {
  const base = unitKey && BASE_UNITS[unitKey];
  if (base && quantity !== undefined) return { quantity: quantity * base[1], unit: base[0], key: base[0] };
  return { quantity, unit, key: unitKey ?? '' };
}

export function newId(): string {
  return crypto.randomUUID();
}

/**
 * Merges ingredient lines into an existing grocery list. Items with the same name and a
 * compatible unit are summed; everything else is added as a new item.
 */
export function addToGroceryList(
  list: GroceryItem[],
  lines: string[],
  factor = 1,
  recipeId?: string,
): GroceryItem[] {
  const result = list.map((item) => ({ ...item, recipeIds: [...item.recipeIds] }));
  for (const line of lines) {
    if (!line.trim() || isHeading(line)) continue;
    const parsed = parseIngredient(line);
    const name = normalizeName(parsed.name) || parsed.raw;
    const scaled = parsed.quantity !== undefined ? parsed.quantity * factor : undefined;
    const { quantity, unit, key } = toBase(scaled, parsed.unitKey, parsed.unit);
    const existing = result.find(
      (item) =>
        !item.checked &&
        item.name.toLowerCase() === name.toLowerCase() &&
        unitKeyOf(item) === key &&
        (item.quantity === undefined) === (quantity === undefined),
    );
    if (existing) {
      if (existing.quantity !== undefined && quantity !== undefined) existing.quantity += quantity;
      if (recipeId && !existing.recipeIds.includes(recipeId)) existing.recipeIds.push(recipeId);
    } else {
      result.push({
        id: newId(),
        name,
        quantity,
        unit,
        category: categorize(name),
        checked: false,
        recipeIds: recipeId ? [recipeId] : [],
      });
    }
  }
  return result;
}

function unitKeyOf(item: GroceryItem): string {
  if (!item.unit) return '';
  const parsed = parseIngredient(`1 ${item.unit} x`);
  return toBase(1, parsed.unitKey, item.unit).key || item.unit.toLowerCase();
}

export function formatGroceryAmount(item: GroceryItem): string {
  if (item.quantity === undefined) return '';
  if (item.unit === 'g' && item.quantity >= 1000) return `${formatQuantity(item.quantity / 1000)} kg`;
  if (item.unit === 'ml' && item.quantity >= 1000) return `${formatQuantity(item.quantity / 1000)} l`;
  return [formatQuantity(item.quantity), item.unit].filter(Boolean).join(' ');
}

export function groceryListAsText(items: GroceryItem[]): string {
  return CATEGORIES.map((category) => {
    const inCategory = items.filter((i) => i.category === category && !i.checked);
    if (!inCategory.length) return '';
    const lines = inCategory.map((i) => `• ${[formatGroceryAmount(i), i.name].filter(Boolean).join(' ')}`);
    return `${category}\n${lines.join('\n')}`;
  })
    .filter(Boolean)
    .join('\n\n');
}
