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
    modifiedAt: Date.now(),
  };
}

/** Which way a regular (not first) sync should go. */
export function syncDirection(local: AppState, remote: AppState | undefined): 'push' | 'pull' | 'none' {
  if (!remote) return 'push';
  const l = local.modifiedAt ?? 0;
  const r = remote.modifiedAt ?? 0;
  return r > l ? 'pull' : l > r ? 'push' : 'none';
}
