import { addDays, fromISODate, toISODate } from './dates';

const HOUR = 3_600_000;

/** Fasting plans by hours of fasting; the rest of the day is the eating window. */
export const FASTING_PLANS = [12, 14, 16, 18, 20] as const;

export const DEFAULT_FAST_HOURS = 16;

export interface FastRecord {
  id: string;
  /** Epoch milliseconds. */
  start: number;
  end: number;
  targetHours: number;
}

export interface FastingState {
  /** Hours of the chosen plan, e.g. 16 for 16:8. */
  planHours: number;
  /** Start of the running fast (epoch ms); undefined when not fasting. */
  start?: number;
  history: FastRecord[];
}

/** What happens in the body, roughly, after this many hours without food. */
export const FAST_STAGES = [
  { id: 'digesting', fromHours: 0 },
  { id: 'falling', fromHours: 3 },
  { id: 'switching', fromHours: 8 },
  { id: 'burning', fromHours: 12 },
  { id: 'deep', fromHours: 16 },
] as const;

export type FastStageId = (typeof FAST_STAGES)[number]['id'];

export interface FastStatus {
  elapsedMs: number;
  targetMs: number;
  /** 0–1, capped at 1 once the goal is reached. */
  progress: number;
  remainingMs: number;
  endsAt: number;
  done: boolean;
  stage: FastStageId;
  /** The next stage and when it begins, if any. */
  next?: { id: FastStageId; at: number };
}

export function fastStatus(start: number, targetHours: number, now: number): FastStatus {
  const elapsedMs = Math.max(0, now - start);
  const targetMs = targetHours * HOUR;
  const hours = elapsedMs / HOUR;
  let index = 0;
  while (index + 1 < FAST_STAGES.length && hours >= FAST_STAGES[index + 1].fromHours) index++;
  const nextStage = FAST_STAGES[index + 1];
  return {
    elapsedMs,
    targetMs,
    progress: targetMs > 0 ? Math.min(1, elapsedMs / targetMs) : 0,
    remainingMs: Math.max(0, targetMs - elapsedMs),
    endsAt: start + targetMs,
    done: elapsedMs >= targetMs,
    stage: FAST_STAGES[index].id,
    next: nextStage && { id: nextStage.id, at: start + nextStage.fromHours * HOUR },
  };
}

/** "16:24:05" style; hours can exceed 24. */
export function formatDuration(ms: number, withSeconds = true): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return withSeconds ? `${h}:${pad(m)}:${pad(s)}` : `${h}:${pad(m)}`;
}

export const reachedGoal = (f: FastRecord) => f.end - f.start >= f.targetHours * HOUR;

/** Days in a row (ending today or yesterday) on which a fast that reached its goal ended. */
export function fastingStreak(history: FastRecord[], today: string): number {
  const days = new Set(history.filter(reachedGoal).map((f) => toISODate(new Date(f.end))));
  let day = fromISODate(today);
  if (!days.has(today)) day = addDays(day, -1);
  let count = 0;
  while (days.has(toISODate(day))) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
