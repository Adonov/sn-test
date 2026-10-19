import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/persistence', () => ({ loadSaved: async () => null, save: () => true }));

import { exchangeCode, listActivities, stravaConfig } from '../server/strava.js';
import { workoutFromStrava } from '../src/lib/strava';
import { dedupeWorkouts, kindFromHealth, kindFromStrava, trainingAdvice, workoutPace, type Workout } from '../src/lib/workouts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Strava server', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports whether Strava is set up, without the secret', () => {
    vi.stubEnv('STRAVA_CLIENT_ID', '');
    expect(stravaConfig('taisty.onrender.com')).toEqual({ configured: false });
    vi.stubEnv('STRAVA_CLIENT_ID', '123');
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'shh');
    vi.stubEnv('STRAVA_CALLBACK_DOMAIN', '');
    expect(stravaConfig('taisty.onrender.com:443')).toEqual({ configured: true, clientId: '123', callbackDomain: 'taisty.onrender.com' });
  });

  it('exchanges the code using the server-side secret and returns only what the app needs', async () => {
    vi.stubEnv('STRAVA_CLIENT_ID', '123');
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'shh');
    const fetchImpl = vi.fn(async () =>
      json({ access_token: 'a', refresh_token: 'r', expires_at: 99, athlete: { id: 7, firstname: 'Ana', lastname: 'K', city: 'Ljubljana' } }),
    );
    expect(await exchangeCode('code1', fetchImpl as unknown as typeof fetch)).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 99,
      athlete: { id: 7, name: 'Ana K' },
    });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ client_id: '123', client_secret: 'shh', code: 'code1', grant_type: 'authorization_code' });
  });

  it('maps activities and reports revoked access', async () => {
    const ok = vi.fn(async () =>
      json([{ id: 1, sport_type: 'TrailRun', start_date: '2026-10-17T07:00:00Z', moving_time: 3120, elapsed_time: 3300, distance: 10012, average_heartrate: 162.4, total_elevation_gain: 210 }]),
    );
    const [a] = await listActivities('tok', 0, ok as unknown as typeof fetch);
    expect(a).toMatchObject({ id: 1, sportType: 'TrailRun', movingTime: 3120, distance: 10012 });
    const denied = vi.fn(async () => json({ message: 'Authorization Error' }, 401));
    await expect(listActivities('tok', 0, denied as unknown as typeof fetch)).rejects.toThrow('strava_denied');
  });
});

describe('Strava activities in the app', () => {
  it('turns an activity into a workout', () => {
    const w = workoutFromStrava({ id: 1, sportType: 'Ride', start: '2026-10-18T08:00:00Z', movingTime: 5400, elapsedTime: 6000, distance: 45230, kilojoules: 980, averageHeartrate: 138.6 });
    expect(w).toEqual({ id: 's-1', kind: 'ride', start: Date.parse('2026-10-18T08:00:00Z'), minutes: 90, km: 45.2, kcal: 980, heartRate: 139, elevationM: undefined, source: 'strava' });
    expect(workoutFromStrava({ id: 2, sportType: 'Swim', start: '2026-10-18T06:00:00Z', movingTime: 1800, elapsedTime: 1900, distance: 1525 }).km).toBe(1.53);
    // Runs have no calories in Strava's list: estimated from distance and weight.
    expect(workoutFromStrava({ id: 3, sportType: 'Run', start: '2026-10-18T06:00:00Z', movingTime: 3000, elapsedTime: 3100, distance: 10000 }, 60).kcal).toBe(600);
  });

  it('maps sport types', () => {
    expect(['Run', 'TrailRun', 'VirtualRun'].map(kindFromStrava)).toEqual(['run', 'run', 'run']);
    expect(['Ride', 'VirtualRide', 'GravelRide', 'EBikeRide'].map(kindFromStrava)).toEqual(['ride', 'ride', 'ride', 'ride']);
    expect(['Swim', 'Yoga', 'WeightTraining', 'NordicSki', 'Rowing', 'Tennis', 'Golf'].map(kindFromStrava)).toEqual([
      'swim',
      'yoga',
      'strength',
      'ski',
      'row',
      'sport',
      'other',
    ]);
    expect(kindFromHealth('flexibility')).toBe('stretch');
    expect(kindFromHealth('downhillSkiing')).toBe('ski');
    expect(kindFromHealth('soccer')).toBe('sport');
  });
});

describe('workouts from several sources', () => {
  const t0 = Date.UTC(2026, 9, 17, 7);
  const w = (source: Workout['source'], start: number, minutes: number, extra: Partial<Workout> = {}): Workout => ({ id: `${source}-${start}`, kind: 'run', start, minutes, source, ...extra });

  it('counts the same workout once, keeping the most detailed copy', () => {
    const list = dedupeWorkouts([w('manual', t0 + 5 * 60_000, 50), w('health', t0, 52), w('strava', t0 + 60_000, 51, { heartRate: 160 }), w('manual', t0 + 6 * 3_600_000, 30)]);
    expect(list.map((x) => x.source)).toEqual(['strava', 'manual']);
  });

  it('keeps two separate sessions on the same morning', () => {
    expect(dedupeWorkouts([w('strava', t0, 20), w('health', t0 + 25 * 60_000, 40)])).toHaveLength(2);
  });

  it('shows pace and speed per sport', () => {
    expect(workoutPace({ ...w('manual', 0, 52), km: 10 })).toBe('5:12 /km');
    expect(workoutPace({ ...w('manual', 0, 90), kind: 'ride', km: 45.2 }, ',')).toBe('30,1 km/h');
    expect(workoutPace({ ...w('manual', 0, 30), kind: 'swim', km: 1.5 })).toBe('2:00 /100 m');
    expect(workoutPace({ ...w('manual', 0, 30), kind: 'strength' })).toBeUndefined();
  });

  it('suggests stretching after a week of endurance sessions without it', () => {
    const day = (d: number) => Date.UTC(2026, 9, d, 7);
    const week = [w('manual', day(13), 40, { kind: 'ride' }), w('manual', day(15), 40, { kind: 'ride' }), w('manual', day(17), 35, { kind: 'run', km: 6 })];
    expect(trainingAdvice(week, day(18) + 3_600_000)).toMatchObject({ kind: 'mobility', count: 3 });
    expect(trainingAdvice([...week, w('manual', day(16), 15, { kind: 'stretch' })], day(18) + 3_600_000).kind).not.toBe('mobility');
  });
});
