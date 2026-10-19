import { waterGoal as defaultWaterGoal } from './goals';
import { DEFAULT_GOALS, entryNutrients, sumNutrients } from './nutrition';
import type { AppState } from './types';

/** Everything the diary, the widgets and the reminders need to know about one day. */
export function daySummary(s: AppState, date: string) {
  const goals = s.nutritionGoals ?? DEFAULT_GOALS;
  const entries = (s.diary ?? []).filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt);
  const totals = sumNutrients(entries.map(entryNutrients));
  const health = s.device?.health;
  const activity = health?.enabled ? s.device?.activity?.[date] : undefined;
  // Calories burned in workouts are added to the goal, as in most trackers (can be turned off).
  const burned = health?.addExercise ? activity?.exerciseKcal ?? 0 : 0;
  const eaten = totals.kcal ?? 0;
  return {
    goals,
    entries,
    totals,
    eaten,
    burned,
    budget: goals.kcal + burned,
    left: goals.kcal + burned - eaten,
    activity,
    waterMl: s.water?.[date] ?? 0,
    waterGoal: s.waterGoal ?? defaultWaterGoal(s.profile?.weightKg),
  };
}
