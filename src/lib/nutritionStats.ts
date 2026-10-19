import { addDays, fromISODate, toISODate } from './dates';
import { entryNutrients, sumNutrients, type FavoriteFood, type FoodLogEntry } from './nutrition';

/**
 * Consecutive days with at least one logged food, ending today — or yesterday, so the streak
 * doesn't look broken first thing in the morning.
 */
export function loggingStreak(diary: FoodLogEntry[], today: string): number {
  const days = new Set(diary.map((e) => e.date));
  let day = days.has(today) ? fromISODate(today) : addDays(fromISODate(today), -1);
  let streak = 0;
  while (days.has(toISODate(day))) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export interface DayTotal {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  logged: boolean;
}

/** Calorie and macro totals for the `count` days ending at `end` (oldest first). */
export function dailyTotals(diary: FoodLogEntry[], end: string, count: number): DayTotal[] {
  const byDay = new Map<string, FoodLogEntry[]>();
  diary.forEach((e) => byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]));
  return Array.from({ length: count }, (_, i) => {
    const date = toISODate(addDays(fromISODate(end), i - count + 1));
    const entries = byDay.get(date) ?? [];
    const n = sumNutrients(entries.map(entryNutrients));
    return { date, kcal: n.kcal ?? 0, protein: n.protein ?? 0, carbs: n.carbs ?? 0, fat: n.fat ?? 0, logged: entries.length > 0 };
  });
}

/** Distinct foods logged recently, newest first, ready to log again. */
export function recentFoods(diary: FoodLogEntry[], limit = 8): Omit<FavoriteFood, 'id'>[] {
  const seen = new Set<string>();
  const out: Omit<FavoriteFood, 'id'>[] = [];
  for (const e of [...diary].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = `${e.name.toLowerCase()}|${e.unit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: e.name, amount: e.amount, unit: e.unit, perUnit: e.perUnit });
    if (out.length >= limit) break;
  }
  return out;
}
