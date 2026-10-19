import { addDays, fromISODate, toISODate } from './dates';

export type WorkoutKind = 'run' | 'ride' | 'walk' | 'hike' | 'swim' | 'strength' | 'hiit' | 'yoga' | 'other';

export const WORKOUT_KINDS: WorkoutKind[] = ['run', 'ride', 'walk', 'hike', 'swim', 'strength', 'hiit', 'yoga', 'other'];

/** Kinds measured by distance. */
export const DISTANCE_KINDS: WorkoutKind[] = ['run', 'ride', 'walk', 'hike', 'swim'];

/** Endurance kinds after which we ask about gels, drinks and food. */
export const FUEL_KINDS: WorkoutKind[] = ['run', 'ride', 'hike', 'swim'];

export interface Workout {
  id: string;
  kind: WorkoutKind;
  /** Epoch milliseconds. */
  start: number;
  minutes: number;
  km?: number;
  kcal?: number;
  source: 'health' | 'manual';
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Apple Health / Health Connect workout types → our kinds. */
export function kindFromHealth(type: string): WorkoutKind {
  const t = type.toLowerCase();
  if (t.includes('run') || t === 'trackandfield') return 'run';
  if (t.includes('cycl') || t.includes('biking') || t === 'handcycling') return 'ride';
  if (t.includes('walk')) return 'walk';
  if (t.includes('hik') || t === 'snowshoeing' || t.includes('climb')) return 'hike';
  if (t.includes('swim') || t === 'waterpolo') return 'swim';
  if (t.includes('highintensity') || t === 'crosstraining' || t === 'bootcamp' || t === 'burpee' || t === 'jumprope') return 'hiit';
  if (t.includes('strength') || t.includes('weight') || t.includes('press') || t.includes('lift') || t === 'calisthenics' || t === 'coretraining')
    return 'strength';
  if (t.includes('yoga') || t.includes('pilates') || t.includes('stretch') || t.includes('flexib') || t === 'cooldown' || t === 'taichi')
    return 'yoga';
  return 'other';
}

// Rough energy cost (MET) per kind, for workouts entered by hand.
const MET: Record<WorkoutKind, number> = { run: 9.8, ride: 7.5, walk: 3.5, hike: 6, swim: 7, strength: 5, hiit: 8, yoga: 2.8, other: 5 };

/** Estimated calories for a workout entered by hand. Running uses ~1 kcal per kg and km when the distance is known. */
export function estimateKcal(kind: WorkoutKind, minutes: number, weightKg = 70, km?: number): number {
  if (kind === 'run' && km) return Math.round(weightKg * km);
  return Math.round(((MET[kind] * 3.5 * weightKg) / 200) * minutes);
}

// ---- Training load ----

const INTENSITY: Record<WorkoutKind, number> = { run: 1.3, ride: 1, walk: 0.4, hike: 0.8, swim: 1.1, strength: 0.9, hiit: 1.5, yoga: 0.3, other: 0.8 };

export function load(w: Workout): number {
  return w.minutes * INTENSITY[w.kind];
}

/**
 * Hours the body typically needs before the next hard session of the same kind. 0 means the
 * workout wasn't demanding. Simple rules of thumb – no heart rate data is used.
 */
export function recoveryHours(w: Workout): number {
  switch (w.kind) {
    case 'run':
      // Runners often use "one easy day per mile raced"; these are the short end of that.
      if ((w.km ?? 0) >= 21 || w.minutes >= 100) return 96;
      if ((w.km ?? 0) >= 10 || w.minutes >= 60) return 72;
      if (w.minutes >= 40) return 24;
      return 0;
    case 'ride':
      if ((w.km ?? 0) >= 80 || w.minutes >= 180) return 48;
      if ((w.km ?? 0) >= 50 || w.minutes >= 120) return 24;
      return 0;
    case 'hiit':
      return w.minutes >= 20 ? 24 : 0;
    case 'strength':
      return w.minutes >= 60 ? 24 : 0;
    case 'hike':
      return w.minutes >= 240 ? 24 : 0;
    case 'swim':
      return w.minutes >= 75 ? 24 : 0;
    default:
      return 0;
  }
}

/** Kinds that load the legs with impact; an easy ride or a walk is the classic way to recover from them. */
const IMPACT: WorkoutKind[] = ['run', 'hiit'];

export type AdviceKind = 'tooSoon' | 'recover' | 'restDay' | 'rampUp' | 'restart' | 'strength' | 'endurance' | 'keepGoing' | 'start';

export interface Advice {
  kind: AdviceKind;
  /** The workout the advice refers to (the hard one before, for tooSoon and recover). */
  ref?: Workout;
  /** Whole days between `ref` and today. */
  daysAgo?: number;
  /** Hours of recovery `ref` needs. */
  hours?: number;
  /** The workout done too soon (tooSoon). */
  latest?: Workout;
  count?: number;
}

const dayOf = (ms: number) => toISODate(new Date(ms));
const daysBetween = (a: number, b: number) => Math.round((fromISODate(dayOf(b)).getTime() - fromISODate(dayOf(a)).getTime()) / DAY);

/**
 * Today's training advice from recent workouts, most important first: protecting recovery after a
 * hard effort beats everything else.
 */
export function trainingAdvice(workouts: Workout[], now: number, goal?: 'lose' | 'maintain' | 'gain'): Advice {
  const recent = workouts.filter((w) => w.start <= now && now - w.start <= 28 * DAY).sort((a, b) => a.start - b.start);
  if (!recent.length) return { kind: 'start' };

  // A hard session followed too soon by another impact session (e.g. a 10 km race on Saturday, a run again on Monday).
  const latest = recent[recent.length - 1];
  if (IMPACT.includes(latest.kind) && daysBetween(latest.start, now) <= 1) {
    const before = recent
      .filter((w) => w !== latest && IMPACT.includes(w.kind) && recoveryHours(w) >= 48)
      .filter((w) => latest.start - (w.start + w.minutes * 60_000) < recoveryHours(w) * HOUR && daysBetween(w.start, latest.start) >= 1)
      .pop();
    if (before) {
      return { kind: 'tooSoon', ref: before, latest, daysAgo: daysBetween(before.start, latest.start), hours: recoveryHours(before) };
    }
  }

  // Still recovering from a hard session and nothing done today yet.
  const doneToday = recent.some((w) => dayOf(w.start) === dayOf(now));
  const hard = [...recent].reverse().find((w) => recoveryHours(w) > 0 && now - (w.start + w.minutes * 60_000) < recoveryHours(w) * HOUR);
  if (hard && !doneToday && daysBetween(hard.start, now) >= 1) {
    return { kind: 'recover', ref: hard, daysAgo: daysBetween(hard.start, now), hours: recoveryHours(hard) };
  }

  // Many days in a row without a break.
  let streak = 0;
  for (let d = new Date(now); recent.some((w) => dayOf(w.start) === toISODate(d)); d = addDays(d, -1)) streak++;
  if (!doneToday) {
    streak = 0;
    for (let d = addDays(new Date(now), -1); recent.some((w) => dayOf(w.start) === toISODate(d)); d = addDays(d, -1)) streak++;
  }
  if (streak >= 5) return { kind: 'restDay', count: streak };

  // This week much harder than the weeks before.
  const week = recent.filter((w) => now - w.start < 7 * DAY).reduce((s, w) => s + load(w), 0);
  const before = recent.filter((w) => now - w.start >= 7 * DAY).reduce((s, w) => s + load(w), 0) / 3;
  if (before > 60 && week > before * 1.3) return { kind: 'rampUp', count: Math.round((week / before - 1) * 100) };

  const sinceLast = daysBetween(latest.start, now);
  if (sinceLast >= 4) return { kind: 'restart', count: sinceLast };
  if (doneToday) return { kind: 'keepGoing' };

  const hadStrength = recent.some((w) => w.kind === 'strength' && now - w.start < 7 * DAY);
  if (!hadStrength || goal === 'gain') return { kind: 'strength' };
  return { kind: 'endurance' };
}

// ---- Fuel ----

export interface FuelItem {
  id: 'gel' | 'drink' | 'bar' | 'banana' | 'shake' | 'water';
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  /** Water in ml added to the day's water. */
  waterMl?: number;
}

/** Typical sports nutrition products, per piece/serving. */
export const FUEL_ITEMS: FuelItem[] = [
  { id: 'gel', kcal: 100, carbs: 25, protein: 0, fat: 0 },
  { id: 'drink', kcal: 120, carbs: 30, protein: 0, fat: 0, waterMl: 500 },
  { id: 'bar', kcal: 230, carbs: 40, protein: 8, fat: 5 },
  { id: 'banana', kcal: 105, carbs: 27, protein: 1.3, fat: 0.4 },
  { id: 'shake', kcal: 200, carbs: 25, protein: 20, fat: 3 },
  { id: 'water', kcal: 0, carbs: 0, protein: 0, fat: 0, waterMl: 500 },
];

/** Whether to ask how the user fuelled this workout. */
export const needsFuelCheck = (w: Workout) => FUEL_KINDS.includes(w.kind) && w.minutes >= 30;

/**
 * Sports-nutrition rules of thumb: carbs during long efforts (30–60 g/h up to 2.5 h, up to 90 g/h
 * beyond) and carbs + protein afterwards.
 */
export function fuelGuide(w: Workout, weightKg = 70) {
  const hours = w.minutes / 60;
  const during = hours < 1 ? undefined : hours <= 2.5 ? ([30, 60] as const) : ([60, 90] as const);
  return {
    during: during && { low: Math.round(during[0] * hours), high: Math.round(during[1] * hours), gels: Math.max(1, Math.round((during[0] * hours) / 25)) },
    after: { carbs: Math.round(weightKg * (hours >= 1.5 ? 1.2 : 1)), protein: 20 },
  };
}
