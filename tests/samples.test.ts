import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../src/i18n';
import { categorize, normalizeName } from '../src/lib/grocery';
import { parseIngredient } from '../src/lib/ingredients';
import { SAMPLES } from '../src/lib/samples';
import { localizeSamples, migrate } from '../src/lib/store';
import type { AppState, Recipe } from '../src/lib/types';

const ids = SAMPLES.en.map((s) => s.sampleId);

describe('sample recipes', () => {
  it.each(LANGUAGES.map((l) => l.code))('%s has every sample with the same shape', (lang) => {
    const samples = SAMPLES[lang];
    expect(samples.map((s) => s.sampleId)).toEqual(ids);
    samples.forEach((s, i) => {
      expect(s.ingredients).toHaveLength(SAMPLES.en[i].ingredients.length);
      expect(s.steps).toHaveLength(SAMPLES.en[i].steps.length);
      expect(s.servings).toBe(SAMPLES.en[i].servings);
    });
  });

  it.each(LANGUAGES.map((l) => l.code))('%s ingredients scale and sort like the English ones', (lang) => {
    SAMPLES[lang].forEach((sample, i) =>
      sample.ingredients.forEach((line, j) => {
        const english = SAMPLES.en[i].ingredients[j];
        const parsed = parseIngredient(line);
        expect(parsed.quantity, line).toBe(parseIngredient(english).quantity);
        expect(parsed.unitKey ?? '', line).toBe(parseIngredient(english).unitKey ?? '');
        expect(categorize(normalizeName(parsed.name)), line).toBe(categorize(normalizeName(parseIngredient(english).name)));
      }),
    );
  });
});

describe('localizeSamples', () => {
  const recipe = (over: Partial<Recipe>): Recipe => ({
    ...SAMPLES.en[0],
    id: 'r1',
    favorite: true,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  });
  const state = (recipes: Recipe[]): AppState => ({ version: 1, recipes, plan: [], grocery: [] });

  it('translates unedited samples and keeps the id and favorite flag', () => {
    const [r] = localizeSamples(state([recipe({})]), 'sl').recipes;
    expect(r).toMatchObject({ id: 'r1', favorite: true, title: 'Palačinke', ingredients: SAMPLES.sl[0].ingredients });
  });

  it('leaves edited samples and the user’s own recipes alone', () => {
    const edited = recipe({ updatedAt: 2 });
    const own = recipe({ sampleId: undefined, title: 'Mine' });
    expect(localizeSamples(state([edited, own]), 'de').recipes).toEqual([edited, own]);
  });

  it('recognizes samples saved before they were marked', () => {
    const old = recipe({ sampleId: undefined });
    const [r] = localizeSamples(migrate(state([old])), 'it').recipes;
    expect(r.title).toBe('Crespelle');
  });
});
