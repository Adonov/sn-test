import { useSyncExternalStore } from 'react';
import type { RecipeDraft } from '../../shared/recipeParsing';
import { addToGroceryList, categorize, newId } from './grocery';
import { loadSaved, save } from './persistence';
import { SAMPLE_RECIPES } from './samples';
import type { AppState, GroceryItem, MealSlot, PlanEntry, Recipe } from './types';

function initialState(): AppState {
  const now = Date.now();
  return {
    version: 1,
    recipes: SAMPLE_RECIPES.map((r, i) => ({ ...r, id: newId(), favorite: false, createdAt: now - i, updatedAt: now - i })),
    plan: [],
    grocery: [],
  };
}

let state: AppState = initialState();

/** Loads saved data; must finish before the app renders. */
export async function initStore(): Promise<void> {
  try {
    const raw = await loadSaved();
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === 1 && Array.isArray(parsed.recipes)) state = parsed;
    }
  } catch {
    // Keep the fresh state when saved data is corrupted.
  }
}

const listeners = new Set<() => void>();

function setState(update: (s: AppState) => AppState): void {
  state = update(state);
  if (!save(JSON.stringify(state))) {
    alert('Shramba brskalnika je polna. Odstrani nekaj receptov s fotografijami ali izvozi varnostno kopijo.');
  }
  listeners.forEach((l) => l());
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export function getState(): AppState {
  return state;
}

// ---- Recipes ----

export function saveRecipe(input: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'favorite'> & { id?: string }): string {
  const now = Date.now();
  const id = input.id ?? newId();
  setState((s) => {
    const existing = s.recipes.find((r) => r.id === id);
    const recipe: Recipe = {
      ...input,
      id,
      favorite: existing?.favorite ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    return {
      ...s,
      recipes: existing ? s.recipes.map((r) => (r.id === id ? recipe : r)) : [recipe, ...s.recipes],
    };
  });
  return id;
}

export function deleteRecipe(id: string): void {
  setState((s) => ({
    ...s,
    recipes: s.recipes.filter((r) => r.id !== id),
    plan: s.plan.filter((p) => p.recipeId !== id),
  }));
}

export function toggleFavorite(id: string): void {
  setState((s) => ({
    ...s,
    recipes: s.recipes.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)),
  }));
}

// A draft from the import page waiting to be reviewed in the editor.
let pendingDraft: RecipeDraft | undefined;

export function setPendingDraft(draft: RecipeDraft): void {
  pendingDraft = draft;
}

export function getPendingDraft(): RecipeDraft | undefined {
  return pendingDraft;
}

export function clearPendingDraft(): void {
  pendingDraft = undefined;
}

// Text or link shared into the app from another app, waiting for the import page.
let pendingShare: string | undefined;

export function setPendingShare(text: string): void {
  pendingShare = text;
}

export function getPendingShare(): string | undefined {
  return pendingShare;
}

export function clearPendingShare(): void {
  pendingShare = undefined;
}

// ---- Meal plan ----

export function addPlanEntry(date: string, slot: MealSlot, recipeId: string, servings: number): void {
  const entry: PlanEntry = { id: newId(), date, slot, recipeId, servings };
  setState((s) => ({ ...s, plan: [...s.plan, entry] }));
}

export function updatePlanServings(id: string, servings: number): void {
  setState((s) => ({ ...s, plan: s.plan.map((p) => (p.id === id ? { ...p, servings } : p)) }));
}

export function removePlanEntry(id: string): void {
  setState((s) => ({ ...s, plan: s.plan.filter((p) => p.id !== id) }));
}

// ---- Grocery list ----

export function addRecipeToGrocery(recipe: Recipe, servings = recipe.servings, lines = recipe.ingredients): void {
  setState((s) => ({
    ...s,
    grocery: addToGroceryList(s.grocery, lines, servings / (recipe.servings || 1), recipe.id),
  }));
}

/** Adds every planned meal in the date range (inclusive) to the grocery list. Returns the meal count. */
export function addPlanToGrocery(from: string, to: string): number {
  const entries = state.plan.filter((p) => p.date >= from && p.date <= to);
  let count = 0;
  setState((s) => {
    let grocery = s.grocery;
    for (const entry of entries) {
      const recipe = s.recipes.find((r) => r.id === entry.recipeId);
      if (!recipe) continue;
      grocery = addToGroceryList(grocery, recipe.ingredients, entry.servings / (recipe.servings || 1), recipe.id);
      count++;
    }
    return { ...s, grocery };
  });
  return count;
}

export function addManualGroceryItem(text: string): void {
  setState((s) => ({ ...s, grocery: addToGroceryList(s.grocery, [text]) }));
}

export function toggleGroceryItem(id: string): void {
  setState((s) => ({ ...s, grocery: s.grocery.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g)) }));
}

export function updateGroceryItem(id: string, patch: Partial<GroceryItem>): void {
  setState((s) => ({
    ...s,
    grocery: s.grocery.map((g) =>
      g.id === id ? { ...g, ...patch, category: patch.name && !patch.category ? categorize(patch.name) : patch.category ?? g.category } : g,
    ),
  }));
}

export function removeGroceryItem(id: string): void {
  setState((s) => ({ ...s, grocery: s.grocery.filter((g) => g.id !== id) }));
}

export function clearGrocery(onlyChecked: boolean): void {
  setState((s) => ({ ...s, grocery: onlyChecked ? s.grocery.filter((g) => !g.checked) : [] }));
}

// ---- Backup ----

export function exportBackup(): string {
  return JSON.stringify(state, null, 2);
}

export function importBackup(json: string): void {
  const parsed = JSON.parse(json) as AppState;
  if (parsed.version !== 1 || !Array.isArray(parsed.recipes) || !Array.isArray(parsed.plan) || !Array.isArray(parsed.grocery)) {
    throw new Error('Datoteka ni veljavna varnostna kopija.');
  }
  setState(() => parsed);
}

export function resetAll(): void {
  setState(() => initialState());
}
