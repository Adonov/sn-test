import { useEffect, useState } from 'react';
import type { StravaActivity, StravaTokens } from '../../server/strava';
import { ApiError, getJson, postJson } from './api';
import { isNative } from './platform';
import { getState, setStrava, setStravaWorkouts } from './store';
import { estimateKcal, kindFromStrava, type Workout } from './workouts';

export interface StravaConnection extends StravaTokens {
  lastSync?: number;
  /** Set when Strava stopped accepting the tokens (access revoked on strava.com). */
  error?: string;
}

interface StravaConfig {
  configured: boolean;
  clientId?: string;
  callbackDomain?: string;
}

const STATE_KEY = 'taisty-strava-state';
let config: Promise<StravaConfig> | undefined;

export function loadStravaConfig(): Promise<StravaConfig> {
  config ??= getJson<StravaConfig>('/api/strava/config').catch(() => {
    config = undefined;
    return { configured: false };
  });
  return config;
}

export function useStravaConfig(): StravaConfig | undefined {
  const [value, setValue] = useState<StravaConfig>();
  useEffect(() => {
    loadStravaConfig().then(setValue);
  }, []);
  return value;
}

/** Opens Strava's authorization page; Strava sends the user back to the app with a code. */
export async function connectStrava(): Promise<void> {
  const { configured, clientId, callbackDomain } = await loadStravaConfig();
  if (!configured || !clientId) throw new ApiError('not_configured', 503);
  const state = crypto.randomUUID();
  try {
    localStorage.setItem(STATE_KEY, state);
  } catch {
    // Without storage the state can't be checked later; the code exchange still validates the code.
  }
  const redirect = isNative ? `taisty://${callbackDomain}/strava` : `${location.origin}/strava-callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
    state,
  });
  // The mobile endpoint hands over to the Strava app when it is installed.
  const url = `https://www.strava.com/oauth/${isNative ? 'mobile/' : ''}authorize?${params}`;
  if (isNative) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    location.assign(url);
  }
}

/** Handles the redirect back from Strava. Resolves false when the user declined. */
export async function finishStravaAuth(params: URLSearchParams): Promise<boolean> {
  let expected: string | null = null;
  try {
    expected = localStorage.getItem(STATE_KEY);
    localStorage.removeItem(STATE_KEY);
  } catch {
    // See connectStrava.
  }
  const code = params.get('code');
  if (!code || params.get('error') || (expected && params.get('state') !== expected)) return false;
  if (!(params.get('scope') ?? '').includes('activity:read')) return false;
  const tokens = await postJson<StravaTokens>('/api/strava/token', { code });
  setStrava({ ...tokens, error: undefined });
  await syncStrava(true);
  return true;
}

/** `weightKg` is used to estimate calories when Strava has none (its activity list only has them for rides). */
export function workoutFromStrava(a: StravaActivity, weightKg?: number): Workout {
  const kind = kindFromStrava(a.sportType ?? '');
  const km = a.distance ? a.distance / 1000 : undefined;
  const minutes = Math.max(1, Math.round((a.movingTime || a.elapsedTime || 0) / 60));
  return {
    id: `s-${a.id}`,
    kind,
    start: Date.parse(a.start),
    minutes,
    km: km ? Math.round(km * (kind === 'swim' ? 100 : 10)) / (kind === 'swim' ? 100 : 10) : undefined,
    // Strava's kilojoules are mechanical work on a bike, which is about equal to the kcal burned.
    kcal: a.calories ? Math.round(a.calories) : a.kilojoules ? Math.round(a.kilojoules) : estimateKcal(kind, minutes, weightKg, km),
    heartRate: a.averageHeartrate ? Math.round(a.averageHeartrate) : undefined,
    elevationM: a.elevationGain ? Math.round(a.elevationGain) : undefined,
    source: 'strava',
  };
}

let running: Promise<void> | undefined;

/** Fetches the last four weeks of activities (at most every 10 minutes unless forced). */
export function syncStrava(force = false): Promise<void> {
  const conn = getState().device?.strava;
  if (!conn || conn.error) return Promise.resolve();
  if (!force && conn.lastSync && Date.now() - conn.lastSync < 10 * 60_000) return Promise.resolve();
  running ??= (async () => {
    try {
      let current = conn;
      if (current.expiresAt - 120 < Date.now() / 1000) {
        current = { ...current, ...(await postJson<StravaTokens>('/api/strava/refresh', { refreshToken: current.refreshToken })) };
        setStrava(current);
      }
      const after = Math.floor(Date.now() / 1000) - 28 * 86_400;
      const { activities } = await getJson<{ activities: StravaActivity[] }>(`/api/strava/activities?after=${after}`, {
        authorization: `Bearer ${current.accessToken}`,
      });
      const { weights = [], profile } = getState();
      const weight = weights[weights.length - 1]?.kg ?? profile?.weightKg;
      setStravaWorkouts(activities.map((a) => workoutFromStrava(a, weight)));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'strava_denied') setStrava({ ...conn, error: 'strava_denied' });
      else console.warn('Strava sync failed', err);
    } finally {
      running = undefined;
    }
  })();
  return running;
}

export async function disconnectStrava(): Promise<void> {
  const conn = getState().device?.strava;
  if (conn && !conn.error) await postJson('/api/strava/deauthorize', {}, { authorization: `Bearer ${conn.accessToken}` }).catch(() => {});
  setStrava(undefined);
}
