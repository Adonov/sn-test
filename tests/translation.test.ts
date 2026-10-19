import { describe, expect, it } from 'vitest';
import { readRecipe, TranslateError, translateRecipe } from '../server/translate.js';
import { localize, needsTranslation } from '../src/lib/localize';
import { detectTextLanguage } from '../src/lib/textLanguage';
import type { Recipe } from '../src/lib/types';

const base: Recipe = {
  id: 'r1',
  title: 'Tiramisu',
  ingredients: ['250 g di mascarpone', '3 uova', '2 cucchiai di zucchero'],
  steps: ['Separa le uova e monta i tuorli con lo zucchero.', 'Aggiungi il mascarpone fino a ottenere una crema.'],
  tags: ['dolce'],
  servings: 4,
  favorite: false,
  createdAt: 1,
  updatedAt: 2,
};

describe('detectTextLanguage', () => {
  it.each([
    ['Mix the flour with the sugar and add the eggs. Bake for 20 minutes.', 'en'],
    ['Mehl mit dem Zucker verrühren und die Eier dazugeben. 20 Minuten backen.', 'de'],
    ['Mezcla la harina con el azúcar y añade los huevos. Hornea 20 minutos.', 'es'],
    ['Mélange la farine avec le sucre et ajoute les œufs dans le bol. Cuire 20 minutes.', 'fr'],
    ['Mescola la farina con lo zucchero e aggiungi le uova. Cuoci per 20 minuti.', 'it'],
    ['Mistura a farinha com o açúcar e junta os ovos numa taça. Coze 20 minutos.', 'pt'],
    ['Moko zmešaj s sladkorjem in dodaj jajca ter mleko. Peci 20 minut.', 'sl'],
    ['Brašno izmiješaj sa šećerom i dodaj jaja te malo mlijeka. Peci 20 minuta.', 'hr'],
  ])('%s', (text, lang) => {
    expect(detectTextLanguage(text)).toBe(lang);
  });

  it('gives up on too little text', () => {
    expect(detectTextLanguage('Tiramisu')).toBeUndefined();
  });
});

describe('localize / needsTranslation', () => {
  it('needs a translation when the recipe is in another language', () => {
    expect(needsTranslation(base, 'sl')).toBe(true);
    expect(needsTranslation(base, 'it')).toBe(false);
  });

  it('shows the stored translation and stops asking for one', () => {
    const translated: Recipe = {
      ...base,
      translations: { sl: { title: 'Tiramisu', ingredients: ['250 g mascarponeja', '3 jajca', '2 žlici sladkorja'], steps: ['a', 'b'], tags: ['sladica'] } },
    };
    expect(localize(translated, 'sl').ingredients[2]).toBe('2 žlici sladkorja');
    expect(localize(translated, 'it').ingredients[2]).toBe('2 cucchiai di zucchero');
    expect(needsTranslation(translated, 'sl')).toBe(false);
  });

  it('never machine-translates unedited samples', () => {
    expect(needsTranslation({ ...base, sampleId: 'pancakes', updatedAt: 1 }, 'sl')).toBe(false);
  });
});

describe('translateRecipe (server)', () => {
  const fakeClient = (reply: object, stop_reason = 'end_turn') => ({
    beta: {
      messages: {
        create: async (params: { output_config: unknown; model: string }) => {
          expect(params.model).toBe('claude-opus-5-5');
          expect(params.output_config).toMatchObject({ effort: 'low', format: { type: 'json_schema' } });
          return { stop_reason, content: [{ type: 'text', text: JSON.stringify(reply) }] };
        },
      },
    },
  });
  const recipe = readRecipe(base);

  it('returns the translated fields', async () => {
    const reply = { title: 'Tiramisu', description: '', ingredients: ['a', 'b', 'c'], steps: ['x', 'y'], notes: '', tags: ['sladica'] };
    await expect(translateRecipe(recipe, 'sl', fakeClient(reply))).resolves.toEqual(reply);
  });

  it('rejects translations that drop or merge lines', async () => {
    const reply = { title: 'T', description: '', ingredients: ['a'], steps: ['x', 'y'], notes: '', tags: [] };
    await expect(translateRecipe(recipe, 'sl', fakeClient(reply))).rejects.toBeInstanceOf(TranslateError);
  });

  it('rejects unknown languages and oversized recipes', async () => {
    await expect(translateRecipe(recipe, 'xx', fakeClient({}))).rejects.toThrow('invalid_language');
    expect(() => readRecipe({ ...base, steps: Array(100).fill('x') })).toThrow('too_large');
  });

  it('reports refusals', async () => {
    await expect(translateRecipe(recipe, 'sl', fakeClient({}, 'refusal'))).rejects.toThrow('refused');
  });
});
