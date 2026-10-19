import { addDays, toISODate } from './dates';
import type { MealSlot } from './types';

export interface TimeReminder {
  on: boolean;
  /** Local time, "HH:MM". */
  time: string;
}

export interface ReminderSettings {
  breakfast: TimeReminder;
  lunch: TimeReminder;
  dinner: TimeReminder;
  water: { on: boolean; from: string; to: string; everyHours: number };
  /** Weekly reminders go out on Mondays. */
  weigh: TimeReminder & { weekly: boolean };
  /** Notify when a fast reaches its goal. */
  fastEnd: boolean;
  /** After a run or ride, ask what was eaten and drunk. */
  fuelCheck: boolean;
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  breakfast: { on: false, time: '08:00' },
  lunch: { on: false, time: '12:30' },
  dinner: { on: false, time: '18:30' },
  water: { on: false, from: '09:00', to: '21:00', everyHours: 2 },
  weigh: { on: false, time: '07:30', weekly: true },
  fastEnd: true,
  fuelCheck: true,
};

export type ReminderKind = 'breakfast' | 'lunch' | 'dinner' | 'water' | 'weigh' | 'fastEnd' | 'fuel';

export interface PlannedReminder {
  id: number;
  kind: ReminderKind;
  at: Date;
}

/** What is already done today, so today's reminders for it can be skipped. */
export interface ReminderContext {
  today: string;
  loggedSlots: MealSlot[];
  waterMl: number;
  waterGoal: number;
  weighedToday: boolean;
  /** When the running fast reaches its goal (epoch ms). */
  fastEndsAt?: number;
  /** Runs and rides whose fuel question is still open: when they ended (epoch ms) and their day. */
  fuelChecks?: { endedAt: number; date: string }[];
}

// iOS keeps at most 64 pending notifications per app.
const MAX_PENDING = 60;
const HORIZON_DAYS = 7;

function at(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0);
}

export function anyReminderOn(s: ReminderSettings): boolean {
  return s.breakfast.on || s.lunch.on || s.dinner.on || s.water.on || s.weigh.on || s.fastEnd || s.fuelCheck;
}

/**
 * One-off notifications for the coming days. They are planned again whenever the data changes,
 * which lets today's reminders skip what's already done (meal logged, water goal reached…).
 */
export function planReminders(s: ReminderSettings, now: Date, ctx: ReminderContext): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const add = (kind: ReminderKind, date: Date) => {
    if (date.getTime() > now.getTime()) out.push({ id: 0, kind, at: date });
  };
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const day = addDays(start, i);
    const isToday = toISODate(day) === ctx.today;
    for (const slot of ['breakfast', 'lunch', 'dinner'] as const) {
      if (s[slot].on && !(isToday && ctx.loggedSlots.includes(slot))) add(slot, at(day, s[slot].time));
    }
    if (s.water.on && !(isToday && ctx.waterMl >= ctx.waterGoal)) {
      const from = at(day, s.water.from);
      const to = at(day, s.water.to);
      const step = Math.max(1, s.water.everyHours) * 3_600_000;
      for (let t = from.getTime(); t <= to.getTime(); t += step) add('water', new Date(t));
    }
    if (s.weigh.on && !(isToday && ctx.weighedToday) && (!s.weigh.weekly || day.getDay() === 1)) add('weigh', at(day, s.weigh.time));
  }
  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  const planned = out.slice(0, MAX_PENDING - 1);
  if (s.fastEnd && ctx.fastEndsAt && ctx.fastEndsAt > now.getTime()) planned.push({ id: 0, kind: 'fastEnd', at: new Date(ctx.fastEndsAt) });
  // Asked shortly after the workout (it usually reaches the app a few minutes after it ends).
  if (s.fuelCheck) {
    for (const f of (ctx.fuelChecks ?? []).filter((f) => now.getTime() - f.endedAt < 3 * 3_600_000).slice(-2)) {
      planned.push({ id: 0, kind: 'fuel', at: new Date(Math.max(now.getTime() + 60_000, f.endedAt + 10 * 60_000)) });
    }
  }
  return planned.map((r, i) => ({ ...r, id: i + 1 }));
}

/** The screen a tapped reminder opens. */
export function reminderRoute(kind: ReminderKind, date: string): string {
  switch (kind) {
    case 'breakfast':
    case 'lunch':
    case 'dinner':
      return `/nutrition/add/${date}/${kind}`;
    case 'weigh':
      return '/nutrition/progress';
    case 'fastEnd':
      return '/fasting';
    case 'fuel':
      return `/nutrition/${date}`;
    default:
      return '/nutrition';
  }
}
