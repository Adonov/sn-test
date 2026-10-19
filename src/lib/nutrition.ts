import type { MealSlot } from './types';

export type NutrientKey =
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'sugar'
  | 'saturatedFat'
  | 'salt'
  | 'vitaminA'
  | 'vitaminC'
  | 'vitaminD'
  | 'vitaminB12'
  | 'calcium'
  | 'iron'
  | 'magnesium'
  | 'potassium'
  | 'zinc';

export type Nutrients = Partial<Record<NutrientKey, number>>;

export interface NutrientInfo {
  key: NutrientKey;
  unit: 'kcal' | 'g' | 'mg' | 'µg';
  group: 'macro' | 'detail' | 'micro';
  /** EU reference intake per day (Regulation 1169/2011, Annex XIII); for sugar, salt and saturated fat a maximum. */
  reference?: number;
  /** Factor from grams (Open Food Facts stores everything per 100 g in grams) to `unit`. */
  fromGrams: number;
}

export const NUTRIENTS: NutrientInfo[] = [
  { key: 'kcal', unit: 'kcal', group: 'macro', reference: 2000, fromGrams: 1 },
  { key: 'protein', unit: 'g', group: 'macro', reference: 50, fromGrams: 1 },
  { key: 'carbs', unit: 'g', group: 'macro', reference: 260, fromGrams: 1 },
  { key: 'fat', unit: 'g', group: 'macro', reference: 70, fromGrams: 1 },
  { key: 'fiber', unit: 'g', group: 'detail', reference: 25, fromGrams: 1 },
  { key: 'sugar', unit: 'g', group: 'detail', reference: 90, fromGrams: 1 },
  { key: 'saturatedFat', unit: 'g', group: 'detail', reference: 20, fromGrams: 1 },
  { key: 'salt', unit: 'g', group: 'detail', reference: 6, fromGrams: 1 },
  { key: 'vitaminA', unit: 'µg', group: 'micro', reference: 800, fromGrams: 1e6 },
  { key: 'vitaminC', unit: 'mg', group: 'micro', reference: 80, fromGrams: 1e3 },
  { key: 'vitaminD', unit: 'µg', group: 'micro', reference: 5, fromGrams: 1e6 },
  { key: 'vitaminB12', unit: 'µg', group: 'micro', reference: 2.5, fromGrams: 1e6 },
  { key: 'calcium', unit: 'mg', group: 'micro', reference: 800, fromGrams: 1e3 },
  { key: 'iron', unit: 'mg', group: 'micro', reference: 14, fromGrams: 1e3 },
  { key: 'magnesium', unit: 'mg', group: 'micro', reference: 375, fromGrams: 1e3 },
  { key: 'potassium', unit: 'mg', group: 'micro', reference: 2000, fromGrams: 1e3 },
  { key: 'zinc', unit: 'mg', group: 'micro', reference: 10, fromGrams: 1e3 },
];

export const NUTRIENT_KEYS = NUTRIENTS.map((n) => n.key);

export type FoodUnit = 'g' | 'ml' | 'serving';

export interface FoodLogEntry {
  id: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  slot: MealSlot;
  name: string;
  amount: number;
  unit: FoodUnit;
  /** Nutrients for one unit (1 g, 1 ml or 1 serving), so the amount can be changed later. */
  perUnit: Nutrients;
  source: 'barcode' | 'search' | 'photo' | 'text' | 'manual' | 'recipe';
  barcode?: string;
  recipeId?: string;
  createdAt: number;
}

export interface NutritionGoals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const DEFAULT_GOALS: NutritionGoals = { kcal: 2000, protein: 100, carbs: 250, fat: 70 };

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out: Nutrients = {};
  for (const key of NUTRIENT_KEYS) {
    const v = n[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v * factor;
  }
  return out;
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const n of list) {
    for (const key of NUTRIENT_KEYS) {
      const v = n[key];
      if (typeof v === 'number' && Number.isFinite(v)) out[key] = (out[key] ?? 0) + v;
    }
  }
  return out;
}

export function entryNutrients(entry: FoodLogEntry): Nutrients {
  return scaleNutrients(entry.perUnit, entry.amount);
}

/** Rounds for display: kcal and mg to whole numbers, grams to one decimal under 10. */
export function formatNutrient(value: number, unit: NutrientInfo['unit'], decimal = ','): string {
  const rounded = unit === 'kcal' || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', decimal)} ${unit}`;
}

const OFF_KEYS: Record<NutrientKey, string> = {
  kcal: 'energy-kcal',
  protein: 'proteins',
  carbs: 'carbohydrates',
  fat: 'fat',
  fiber: 'fiber',
  sugar: 'sugars',
  saturatedFat: 'saturated-fat',
  salt: 'salt',
  vitaminA: 'vitamin-a',
  vitaminC: 'vitamin-c',
  vitaminD: 'vitamin-d',
  vitaminB12: 'vitamin-b12',
  calcium: 'calcium',
  iron: 'iron',
  magnesium: 'magnesium',
  potassium: 'potassium',
  zinc: 'zinc',
};

/** Converts Open Food Facts `nutriments` (per 100 g, in grams) into nutrients per 1 g. */
export function parseOffNutriments(nutriments: Record<string, unknown> | undefined): Nutrients {
  const out: Nutrients = {};
  if (!nutriments) return out;
  for (const info of NUTRIENTS) {
    let value = Number(nutriments[`${OFF_KEYS[info.key]}_100g`]);
    if (info.key === 'kcal' && !Number.isFinite(value)) {
      const kj = Number(nutriments['energy_100g']); // energy in kJ when kcal is missing
      if (Number.isFinite(kj)) value = kj / 4.184;
    }
    if (Number.isFinite(value) && value >= 0) out[info.key] = (value * info.fromGrams) / 100;
  }
  return out;
}
