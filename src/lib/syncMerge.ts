import type { AppState } from './types';

function byId<T extends { id: string }>(...lists: T[][]): Map<string, T> {
  const map = new Map<string, T>();
  lists.flat().forEach((item) => map.set(item.id, item));
  return map;
}

/**
 * Combines this device's data with the account's data the first time a device signs in, so
 * nothing created before signing in is lost. Later syncs simply keep the newer copy.
 */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const recipes = byId(remote.recipes);
  for (const r of local.recipes) {
    const other = recipes.get(r.id);
    if (!other || r.updatedAt > other.updatedAt) recipes.set(r.id, r);
  }
  // Every device starts with its own copy of the samples; keep only one of each.
  const remoteSamples = new Set(remote.recipes.map((r) => r.sampleId).filter(Boolean));
  const merged = [...recipes.values()].filter(
    (r) => !(r.sampleId && r.updatedAt === r.createdAt && remoteSamples.has(r.sampleId) && !remote.recipes.some((x) => x.id === r.id)),
  );
  return {
    version: 1,
    language: local.language,
    recipes: merged.sort((a, b) => b.createdAt - a.createdAt),
    plan: [...byId(remote.plan, local.plan).values()],
    grocery: [...byId(remote.grocery, local.grocery).values()],
    diary: [...byId(remote.diary ?? [], local.diary ?? []).values()],
    nutritionGoals: local.nutritionGoals ?? remote.nutritionGoals,
    profile: local.profile ?? remote.profile,
    waterGoal: local.waterGoal ?? remote.waterGoal,
    // One weight per day: the device's own reading wins for a day both have.
    weights: [...new Map([...(remote.weights ?? []), ...(local.weights ?? [])].map((w) => [w.date, w])).values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    water: mergeMax(remote.water, local.water),
    favoriteFoods: [...byId(remote.favoriteFoods ?? [], local.favoriteFoods ?? []).values()],
    fasting: mergeFasting(local, remote),
    workouts: [...byId(remote.workouts ?? [], local.workouts ?? []).values()].sort((a, b) => a.start - b.start),
    onboardedAt: local.onboardedAt ?? remote.onboardedAt,
    device: local.device,
    modifiedAt: Date.now(),
  };
}

function mergeFasting(local: AppState, remote: AppState): AppState['fasting'] {
  const l = local.fasting;
  const r = remote.fasting;
  if (!l || !r) return l ?? r;
  return {
    planHours: l.planHours,
    start: l.start ?? r.start,
    history: [...byId(r.history, l.history).values()].sort((a, b) => a.start - b.start),
  };
}

/** Combines per-day counters, keeping the higher value for a day both sides have. */
function mergeMax(a: Record<string, number> = {}, b: Record<string, number> = {}): Record<string, number> {
  const out = { ...a };
  for (const [day, value] of Object.entries(b)) out[day] = Math.max(out[day] ?? 0, value);
  return out;
}

/** Which way a regular (not first) sync should go. */
export function syncDirection(local: AppState, remote: AppState | undefined): 'push' | 'pull' | 'none' {
  if (!remote) return 'push';
  const l = local.modifiedAt ?? 0;
  const r = remote.modifiedAt ?? 0;
  return r > l ? 'pull' : l > r ? 'push' : 'none';
}
