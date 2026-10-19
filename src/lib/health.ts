import { addDays, toISODate } from './dates';
import type { WeightEntry } from './nutrition';
import { isNative } from './platform';
import { kindFromHealth, type Workout } from './workouts';

/** Activity for one day from Apple Health / Health Connect. */
export interface DayActivity {
  steps?: number;
  /** Calories burned in workouts. */
  exerciseKcal?: number;
  exerciseMinutes?: number;
}

export interface HealthSettings {
  enabled: boolean;
  /** Adds calories burned in workouts to the day's calorie goal. */
  addExercise: boolean;
  lastSync?: number;
}

export const DEFAULT_HEALTH: HealthSettings = { enabled: false, addExercise: true };

export interface StepBucket {
  startDate: string;
  value: number;
}

export interface WorkoutSample {
  startDate: string;
  /** Seconds. */
  duration: number;
  totalEnergyBurned?: number;
  workoutType?: string;
  /** Meters. */
  totalDistance?: number;
  platformId?: string;
}

/** Health workouts as the app's workouts (used by the coach and the fuel check). */
export function workoutsFromHealth(samples: WorkoutSample[]): Workout[] {
  return samples
    .filter((w) => w.duration >= 300)
    .map((w) => {
      const start = new Date(w.startDate).getTime();
      return {
        id: `h-${w.platformId ?? start}`,
        kind: kindFromHealth(w.workoutType ?? 'other'),
        start,
        minutes: Math.round(w.duration / 60),
        km: w.totalDistance ? Math.round(w.totalDistance / 100) / 10 : undefined,
        kcal: w.totalEnergyBurned ? Math.round(w.totalEnergyBurned) : undefined,
        source: 'health' as const,
      };
    })
    .sort((a, b) => a.start - b.start);
}

export interface WeightSample {
  startDate: string;
  value: number;
}

/** Combines daily step totals and workouts into per-day activity. */
export function activityFromHealth(steps: StepBucket[], workouts: WorkoutSample[]): Record<string, DayActivity> {
  const days: Record<string, DayActivity> = {};
  const day = (iso: string) => (days[toISODate(new Date(iso))] ??= {});
  for (const b of steps) {
    const d = day(b.startDate);
    d.steps = (d.steps ?? 0) + Math.round(b.value);
  }
  for (const w of workouts) {
    const d = day(w.startDate);
    d.exerciseKcal = (d.exerciseKcal ?? 0) + Math.round(w.totalEnergyBurned ?? 0);
    d.exerciseMinutes = (d.exerciseMinutes ?? 0) + Math.round(w.duration / 60);
  }
  return days;
}

/**
 * Adds readings from a smart scale: the last reading of each day, except on days the user entered
 * a weight by hand. Returns undefined when nothing changes.
 */
export function mergeScaleWeights(weights: WeightEntry[], samples: WeightSample[], newId: () => string): WeightEntry[] | undefined {
  const latest = new Map<string, WeightSample>();
  for (const s of [...samples].sort((a, b) => a.startDate.localeCompare(b.startDate))) latest.set(toISODate(new Date(s.startDate)), s);
  const byDate = new Map(weights.map((w) => [w.date, w]));
  let changed = false;
  for (const [date, sample] of latest) {
    const kg = Math.round(sample.value * 10) / 10;
    const existing = byDate.get(date);
    if (existing && (existing.source !== 'health' || existing.kg === kg)) continue;
    byDate.set(date, { id: existing?.id ?? newId(), date, kg, source: 'health' });
    changed = true;
  }
  return changed ? [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) : undefined;
}

// ---- Native access ----

const READ = ['steps', 'calories', 'weight', 'workouts'] as const;

async function plugin() {
  const { Health } = await import('@capgo/capacitor-health');
  return Health;
}

export async function healthAvailable(): Promise<boolean> {
  if (!isNative) return false;
  try {
    return (await (await plugin()).isAvailable()).available;
  } catch {
    return false;
  }
}

/** Shows the system permission sheet. Resolves false when Health isn't available on this device. */
export async function requestHealthAccess(): Promise<boolean> {
  if (!(await healthAvailable())) return false;
  await (await plugin()).requestAuthorization({ read: [...READ] });
  return true;
}

export async function openHealthSettings(): Promise<void> {
  await (await plugin()).openHealthConnectSettings().catch(() => {});
}

export interface HealthData {
  activity: Record<string, DayActivity>;
  /** The last four weeks of workouts. */
  workouts: Workout[];
  weights: WeightSample[];
}

/** Reads the last weeks of activity and workouts and the last month of weight readings. */
export async function readHealthData(days = 28): Promise<HealthData> {
  const health = await plugin();
  const now = new Date();
  const from = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -(days - 1));
  const endDate = now.toISOString();
  const [steps, workouts, weights] = await Promise.all([
    health
      .queryAggregated({ dataType: 'steps', startDate: from.toISOString(), endDate, bucket: 'day', aggregation: 'sum' })
      .then((r) => r.samples)
      .catch(() => []),
    health
      .queryWorkouts({ startDate: from.toISOString(), endDate, limit: 200 })
      .then((r) => r.workouts)
      .catch(() => []),
    health
      .readSamples({ dataType: 'weight', startDate: addDays(now, -30).toISOString(), endDate, limit: 200 })
      .then((r) => r.samples)
      .catch(() => []),
  ]);
  return { activity: activityFromHealth(steps, workouts), workouts: workoutsFromHealth(workouts), weights };
}
