import { describe, expect, it } from 'vitest';
import { estimateFoods, estimateRecipe, NutritionError } from '../server/nutrition.js';
import { toProduct } from '../src/lib/foodDb';
import { entryNutrients, formatNutrient, parseOffNutriments, scaleNutrients, sumNutrients, type FoodLogEntry } from '../src/lib/nutrition';
import { mergeStates } from '../src/lib/syncMerge';
import { slotForNow } from '../src/pages/AddFood';

describe('Open Food Facts parsing', () => {
  it('converts per-100 g values in grams into per-gram values in display units', () => {
    const n = parseOffNutriments({
      'energy-kcal_100g': 250,
      proteins_100g: 10,
      carbohydrates_100g: 30,
      fat_100g: 8,
      salt_100g: 1.2,
      'vitamin-c_100g': 0.012, // 12 mg
      'vitamin-d_100g': 0.0000025, // 2.5 µg
      calcium_100g: 0.12, // 120 mg
    });
    expect(n.kcal).toBeCloseTo(2.5);
    expect(n.protein).toBeCloseTo(0.1);
    expect(n.salt).toBeCloseTo(0.012);
    expect(n.vitaminC).toBeCloseTo(0.12);
    expect(n.vitaminD).toBeCloseTo(0.025);
    expect(n.calcium).toBeCloseTo(1.2);
    expect(n.fiber).toBeUndefined();
  });

  it('falls back to kJ when kcal is missing', () => {
    expect(parseOffNutriments({ energy_100g: 418.4 }).kcal).toBeCloseTo(1);
  });

  it('builds a product in the requested language and skips ones without energy', () => {
    const p = toProduct(
      { code: '3830000000000', product_name: 'Yogurt', product_name_sl: 'Jogurt', brands: 'Ljubljanske mlekarne, LM', nutriments: { 'energy-kcal_100g': 60 }, serving_quantity: '180' },
      'sl',
    );
    expect(p).toMatchObject({ name: 'Jogurt', brand: 'Ljubljanske mlekarne', servingGrams: 180, barcode: '3830000000000' });
    expect(toProduct({ product_name: 'Water', nutriments: {} }, 'en')).toBeUndefined();
  });
});

describe('nutrient maths', () => {
  it('scales, sums and formats', () => {
    const egg = { kcal: 1.4, protein: 0.13 };
    expect(scaleNutrients(egg, 50)).toEqual({ kcal: 70, protein: 6.5 });
    expect(sumNutrients([{ kcal: 70 }, { kcal: 30, fat: 2 }])).toEqual({ kcal: 100, fat: 2 });
    expect(formatNutrient(6.54, 'g')).toBe('6,5 g');
    expect(formatNutrient(123.4, 'kcal', '.')).toBe('123 kcal');
  });

  it('computes an entry from its amount', () => {
    const entry = { amount: 2, unit: 'serving', perUnit: { kcal: 350 } } as FoodLogEntry;
    expect(entryNutrients(entry).kcal).toBe(700);
  });

  it('suggests the meal from the time of day', () => {
    expect(slotForNow(new Date(2026, 0, 1, 8))).toBe('breakfast');
    expect(slotForNow(new Date(2026, 0, 1, 13))).toBe('lunch');
    expect(slotForNow(new Date(2026, 0, 1, 16))).toBe('snack');
    expect(slotForNow(new Date(2026, 0, 1, 20))).toBe('dinner');
  });
});

describe('server estimates', () => {
  const fake = (reply: object, check?: (params: { messages: { content: unknown }[]; output_config: unknown }) => void) => ({
    beta: {
      messages: {
        create: async (params: { messages: { content: unknown }[]; output_config: unknown; model: string }) => {
          expect(params.model).toBe('claude-opus-5-5');
          check?.(params);
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(reply) }] };
        },
      },
    },
  });

  it('sends the photo as an image block and drops empty items', async () => {
    const image = 'data:image/jpeg;base64,/9j/AAAA';
    const items = await estimateFoods(
      { image, lang: 'sl' },
      fake({ items: [{ name: 'Jajce', amount: 50, unit: 'g', nutrients: { kcal: 70, protein: 6, carbs: 0, fat: 5 } }, { name: 'x', amount: 0, unit: 'g', nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0 } }] }, (p) => {
        const content = p.messages[0].content as { type: string; source?: { data: string } }[];
        expect(content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/AAAA' } });
        expect(JSON.stringify(content)).toContain('Slovenian');
      }),
    );
    expect(items).toEqual([{ name: 'Jajce', amount: 50, unit: 'g', nutrients: { kcal: 70, protein: 6, carbs: 0, fat: 5 } }]);
  });

  it('rejects bad input before calling the model', async () => {
    await expect(estimateFoods({ image: 'data:text/html;base64,AAAA' }, fake({}))).rejects.toBeInstanceOf(NutritionError);
    await expect(estimateFoods({ text: '   ' }, fake({}))).rejects.toThrow('invalid_input');
    await expect(estimateRecipe({ ingredients: [] }, fake({}))).rejects.toThrow('invalid_input');
  });

  it('estimates one serving of a recipe', async () => {
    const perServing = { kcal: 420, protein: 30, carbs: 40, fat: 12 };
    await expect(
      estimateRecipe(
        { title: 'Curry', servings: 4, ingredients: ['600 g chicken'] },
        fake({ perServing }, (p) => expect(JSON.stringify(p.messages)).toContain('Makes 4 servings')),
      ),
    ).resolves.toEqual(perServing);
  });
});

describe('diary sync', () => {
  it('keeps diary entries from both devices', () => {
    const entry = (id: string) => ({ id, date: '2026-10-19', slot: 'lunch', name: id, amount: 1, unit: 'serving', perUnit: {}, source: 'manual', createdAt: 1 }) as FoodLogEntry;
    const merged = mergeStates(
      { version: 1, recipes: [], plan: [], grocery: [], diary: [entry('a')] },
      { version: 1, recipes: [], plan: [], grocery: [], diary: [entry('b')] },
    );
    expect(merged.diary?.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });
});
