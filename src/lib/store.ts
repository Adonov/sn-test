import { useSyncExternalStore } from 'react';
import type { RecipeDraft } from '../../shared/recipeParsing';
import { detectLanguage, type Language } from '../i18n/languages';
import { addToGroceryList, categorize, newId, toCategoryId } from './grocery';
import { loadSaved, save } from './persistence';
import { SAMPLES } from './samples';
import { localize } from './localize';
import { DEFAULT_FAST_HOURS, type FastingState } from './fasting';
import type { Profile } from './goals';
import { mergeScaleWeights, type HealthData } from './health';
import type { FavoriteFood, FoodLogEntry, Nutrients, NutritionGoals, WeightEntry } from './nutrition';
import type { ReminderSettings } from './reminders';
import type { StravaConnection } from './strava';
import type { Workout } from './workouts';
import type { AppState, DeviceState, GroceryItem, MealSlot, PlanEntry, Recipe, RecipeText } from './types';

function initialState(language?: Language): AppState {
  const now = Date.now();
  const samples = SAMPLES[language ?? detectLanguage()];
  return {
    version: 1,
    language,
    recipes: samples.map((r, i) => ({ ...r, id: newId(), favorite: false, createdAt: now - i, updatedAt: now - i })),
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
      if (parsed.version === 1 && Array.isArray(parsed.recipes)) {
        state = localizeSamples(migrate(parsed), parsed.language ?? detectLanguage());
      }
    }
  } catch {
    // Keep the fresh state when saved data is corrupted.
  }
}

const isUnedited = (r: Recipe) => r.updatedAt === r.createdAt;

/**
 * Upgrades data saved by older versions: grocery categories used to be Slovenian names, and
 * sample recipes weren't marked, so unedited ones are recognized by their title.
 */
export function migrate(saved: AppState): AppState {
  const sampleIdByTitle = new Map(Object.values(SAMPLES).flat().map((s) => [s.title, s.sampleId]));
  return {
    ...saved,
    recipes: saved.recipes.map((r) =>
      r.sampleId || !isUnedited(r) || !sampleIdByTitle.has(r.title) ? r : { ...r, sampleId: sampleIdByTitle.get(r.title) },
    ),
    grocery: saved.grocery.map((g) => ({ ...g, category: toCategoryId(g.category) })),
  };
}

/** Rewrites sample recipes the user hasn't edited in the given language. */
export function localizeSamples(s: AppState, language: Language): AppState {
  return {
    ...s,
    recipes: s.recipes.map((r) => {
      const sample = r.sampleId && isUnedited(r) ? SAMPLES[language].find((x) => x.sampleId === r.sampleId) : undefined;
      return sample ? { ...r, ...sample } : r;
    }),
  };
}

const listeners = new Set<() => void>();

/** Called after every local change (not after applying synced data). */
const changeListeners = new Set<() => void>();

export function onLocalChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function setState(update: (s: AppState) => AppState, fromSync = false): void {
  state = fromSync ? update(state) : { ...update(state), modifiedAt: Date.now() };
  if (!save(JSON.stringify(state))) {
    // Imported lazily to avoid a circular import (i18n reads the store).
    import('../i18n').then(({ translate }) => alert(translate(state.language ?? detectLanguage(), 'store.quotaFull')));
  }
  listeners.forEach((l) => l());
  if (!fromSync) changeListeners.forEach((l) => l());
}

/** Changes device-only data: it isn't synced, so it doesn't count as a change to the account's data. */
function setDevice(update: (d: DeviceState) => DeviceState): void {
  setState((s) => ({ ...s, device: update(s.device ?? {}) }), true);
}

/** Replaces the data with a copy from the cloud, keeping this device's language and settings. */
export function applySyncedState(remote: AppState): void {
  setState(
    (s) => localizeSamples({ ...migrate(remote), language: s.language, device: s.device }, s.language ?? detectLanguage()),
    true,
  );
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

/** Runs after every change, local or synced. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): AppState {
  return state;
}

// ---- Settings ----

export function setLanguage(language: Language): void {
  setState((s) => localizeSamples({ ...s, language }, language));
}

export function finishOnboarding(): void {
  setState((s) => ({ ...s, onboardedAt: Date.now() }));
}

export function setReminders(reminders: ReminderSettings): void {
  setDevice((d) => ({ ...d, reminders }));
}

export function setHealthSettings(patch: Partial<NonNullable<DeviceState['health']>>): void {
  setDevice((d) => ({ ...d, health: { enabled: false, addExercise: true, ...d.health, ...patch } }));
}

/** Stores activity read from Apple Health / Health Connect and adds new smart-scale weights. */
export function applyHealthData(data: HealthData): void {
  setDevice((d) => ({
    ...d,
    activity: { ...d.activity, ...data.activity },
    healthWorkouts: data.workouts,
    health: { enabled: true, addExercise: true, ...d.health, lastSync: Date.now() },
  }));
  const weights = mergeScaleWeights(state.weights ?? [], data.weights, newId);
  if (weights) {
    setState((s) => {
      const latest = weights[weights.length - 1];
      return { ...s, weights, profile: s.profile ? { ...s.profile, weightKg: latest.kg } : s.profile };
    });
  }
}

// ---- Workouts ----

export function addWorkout(workout: Omit<Workout, 'id' | 'source'>): void {
  setState((s) => ({ ...s, workouts: [...(s.workouts ?? []), { ...workout, id: newId(), source: 'manual' as const }].slice(-500) }));
}

export function removeWorkout(id: string): void {
  setState((s) => ({ ...s, workouts: (s.workouts ?? []).filter((w) => w.id !== id) }));
}

/** Marks the fuel question for a workout as answered (or dismissed). */
export function markFuelChecked(workoutId: string): void {
  setDevice((d) => ({ ...d, fuelChecked: [...(d.fuelChecked ?? []).filter((id) => id !== workoutId), workoutId].slice(-100) }));
}

export function setStrava(connection: StravaConnection | undefined): void {
  setDevice((d) =>
    connection
      ? { ...d, strava: { ...d.strava, ...connection, lastSync: connection.lastSync ?? d.strava?.lastSync } }
      : { ...d, strava: undefined, stravaWorkouts: undefined },
  );
}

export function setStravaWorkouts(workouts: Workout[]): void {
  setDevice((d) => (d.strava ? { ...d, stravaWorkouts: workouts, strava: { ...d.strava, lastSync: Date.now(), error: undefined } } : d));
}

export { allWorkouts } from './workouts';

// ---- Fasting ----

const fastingOf = (s: AppState): FastingState => s.fasting ?? { planHours: DEFAULT_FAST_HOURS, history: [] };

export function setFastingPlan(planHours: number): void {
  setState((s) => ({ ...s, fasting: { ...fastingOf(s), planHours } }));
}

export function startFast(start = Date.now()): void {
  setState((s) => ({ ...s, fasting: { ...fastingOf(s), start } }));
}

/** Moves the start of the running fast (e.g. "I stopped eating at 20:00"). */
export function setFastStart(start: number): void {
  setState((s) => (s.fasting?.start ? { ...s, fasting: { ...s.fasting, start: Math.min(start, Date.now()) } } : s));
}

export function endFast(end = Date.now()): void {
  setState((s) => {
    const f = fastingOf(s);
    if (!f.start) return s;
    const record = { id: newId(), start: f.start, end: Math.max(end, f.start), targetHours: f.planHours };
    // Very short fasts are usually a mis-tap; they aren't kept.
    const history = end - f.start >= 3_600_000 ? [...f.history, record].slice(-200) : f.history;
    return { ...s, fasting: { ...f, start: undefined, history } };
  });
}

export function removeFast(id: string): void {
  setState((s) => ({ ...s, fasting: { ...fastingOf(s), history: fastingOf(s).history.filter((f) => f.id !== id) } }));
}

// ---- Recipes ----

/** Stores a machine translation, unless the recipe was edited while it was being translated. */
export function setRecipeTranslation(id: string, lang: Language, text: RecipeText, basedOn: number): void {
  setState((s) => ({
    ...s,
    recipes: s.recipes.map((r) =>
      r.id === id && r.updatedAt === basedOn ? { ...r, translations: { ...r.translations, [lang]: text } } : r,
    ),
  }));
}

export function saveRecipe(input: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'favorite'> & { id?: string }): string {
  const now = Date.now();
  const id = input.id ?? newId();
  setState((s) => {
    const existing = s.recipes.find((r) => r.id === id);
    const recipe: Recipe = {
      ...input,
      id,
      favorite: existing?.favorite ?? false,
      // Saved text is the new original; old translations and estimates no longer match it.
      translations: undefined,
      nutrition: undefined,
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

/** Stores an estimated nutrition per serving, unless the recipe was edited meanwhile. */
export function setRecipeNutrition(id: string, nutrition: Nutrients, basedOn: number): void {
  setState((s) => ({
    ...s,
    recipes: s.recipes.map((r) => (r.id === id && r.updatedAt === basedOn ? { ...r, nutrition } : r)),
  }));
}

// ---- Food diary ----

/** Adds entries to the diary and returns their ids. */
export function addDiaryEntries(entries: Omit<FoodLogEntry, 'id' | 'createdAt'>[]): string[] {
  const now = Date.now();
  const added = entries.map((e, i) => ({ ...e, id: newId(), createdAt: now + i }));
  setState((s) => ({ ...s, diary: [...(s.diary ?? []), ...added] }));
  return added.map((e) => e.id);
}

export function updateDiaryEntry(id: string, patch: Partial<Pick<FoodLogEntry, 'amount' | 'slot' | 'name'>>): void {
  setState((s) => ({ ...s, diary: (s.diary ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
}

export function removeDiaryEntry(id: string): void {
  setState((s) => ({ ...s, diary: (s.diary ?? []).filter((e) => e.id !== id) }));
}

export function setNutritionGoals(goals: NutritionGoals, profile?: Profile, waterGoal?: number): void {
  setState((s) => ({ ...s, nutritionGoals: goals, profile: profile ?? s.profile, waterGoal: waterGoal ?? s.waterGoal }));
}

/** Records today's (or any day's) weight; one value per day. */
export function logWeight(date: string, kg: number): void {
  setState((s) => {
    const others = (s.weights ?? []).filter((w) => w.date !== date);
    const weights = [...others, { id: newId(), date, kg } as WeightEntry].sort((a, b) => a.date.localeCompare(b.date));
    // The latest weight keeps the profile (and future goal calculations) current.
    const latest = weights[weights.length - 1];
    return { ...s, weights, profile: s.profile ? { ...s.profile, weightKg: latest.kg } : s.profile };
  });
}

export function removeWeight(id: string): void {
  setState((s) => ({ ...s, weights: (s.weights ?? []).filter((w) => w.id !== id) }));
}

export function addWater(date: string, ml: number): void {
  setState((s) => {
    const current = s.water?.[date] ?? 0;
    return { ...s, water: { ...s.water, [date]: Math.max(0, current + ml) } };
  });
}

export function toggleFavoriteFood(food: Omit<FavoriteFood, 'id'>): void {
  setState((s) => {
    const list = s.favoriteFoods ?? [];
    const existing = list.find((f) => f.name === food.name && f.unit === food.unit);
    return {
      ...s,
      favoriteFoods: existing ? list.filter((f) => f !== existing) : [...list, { ...food, id: newId() }],
    };
  });
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
      // Grocery items are written in the language the app is shown in.
      const { ingredients } = localize(recipe, s.language ?? detectLanguage());
      grocery = addToGroceryList(grocery, ingredients, entry.servings / (recipe.servings || 1), recipe.id);
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
    throw new Error('invalid_backup');
  }
  setState((s) => ({ ...migrate(parsed), language: parsed.language ?? s.language, device: s.device }));
}

export function resetAll(): void {
  setState((s) => ({ ...initialState(s.language), device: s.device }));
}
