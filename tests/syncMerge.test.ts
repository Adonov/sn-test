import { describe, expect, it } from 'vitest';
import { mergeStates, syncDirection } from '../src/lib/syncMerge';
import type { AppState, Recipe } from '../src/lib/types';

const recipe = (id: string, over: Partial<Recipe> = {}): Recipe => ({
  id,
  title: id,
  ingredients: [],
  steps: [],
  tags: [],
  servings: 2,
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});
const state = (over: Partial<AppState>): AppState => ({ version: 1, recipes: [], plan: [], grocery: [], ...over });

describe('mergeStates', () => {
  it('keeps recipes from both sides and the newer copy of shared ones', () => {
    const local = state({ recipes: [recipe('a'), recipe('b', { title: 'local B', updatedAt: 5 })], language: 'sl' });
    const remote = state({ recipes: [recipe('b', { title: 'remote B', updatedAt: 3 }), recipe('c')], language: 'en' });
    const merged = mergeStates(local, remote);
    expect(merged.recipes.map((r) => r.id).sort()).toEqual(['a', 'b', 'c']);
    expect(merged.recipes.find((r) => r.id === 'b')!.title).toBe('local B');
    expect(merged.language).toBe('sl');
  });

  it('does not duplicate the sample recipes every device starts with', () => {
    const local = state({ recipes: [recipe('l1', { sampleId: 'pancakes' }), recipe('mine', { updatedAt: 2 })] });
    const remote = state({ recipes: [recipe('r1', { sampleId: 'pancakes' })] });
    expect(mergeStates(local, remote).recipes.map((r) => r.id).sort()).toEqual(['mine', 'r1']);
  });

  it('keeps a sample the user edited on this device', () => {
    const local = state({ recipes: [recipe('l1', { sampleId: 'pancakes', updatedAt: 9 })] });
    const remote = state({ recipes: [recipe('r1', { sampleId: 'pancakes' })] });
    expect(mergeStates(local, remote).recipes).toHaveLength(2);
  });

  it('combines plan and grocery entries', () => {
    const local = state({ plan: [{ id: 'p1', date: '2026-10-19', slot: 'dinner', recipeId: 'a', servings: 2 }] });
    const remote = state({ plan: [{ id: 'p2', date: '2026-10-20', slot: 'lunch', recipeId: 'b', servings: 2 }] });
    expect(mergeStates(local, remote).plan).toHaveLength(2);
  });
});

describe('syncDirection', () => {
  it('uploads when the account is empty or older, downloads when it is newer', () => {
    expect(syncDirection(state({ modifiedAt: 5 }), undefined)).toBe('push');
    expect(syncDirection(state({ modifiedAt: 5 }), state({ modifiedAt: 3 }))).toBe('push');
    expect(syncDirection(state({ modifiedAt: 5 }), state({ modifiedAt: 8 }))).toBe('pull');
    expect(syncDirection(state({ modifiedAt: 5 }), state({ modifiedAt: 5 }))).toBe('none');
  });
});
