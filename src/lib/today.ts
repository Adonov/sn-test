import { toISODate } from './dates';
import { waterGoal as defaultWaterGoal } from './goals';
import { DEFAULT_GOALS, entryNutrients, sumNutrients } from './nutrition';
import type { AppState } from './types';
import { allWorkouts } from './workouts';

/** Everything the diary, the widgets and the reminders need to know about one day. */
export function daySummary(s: AppState, date: string) {
  const goals = s.nutritionGoals ?? DEFAULT_GOALS;
  const entries = (s.diary ?? []).filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt);
  const totals = sumNutrients(entries.map(entryNutrients));
  const health = s.device?.health;
  const activity = health?.enabled ? s.device?.activity?.[date] : undefined;
  const workouts = allWorkouts(s).filter((w) => toISODate(new Date(w.start)) === date);
  const workoutKcal = workouts.reduce((sum, w) => sum + (w.kcal ?? 0), 0);
  // Calories burned in workouts are added to the goal, as in most trackers (can be turned off).
  const addExercise = health?.addExercise ?? true;
  const burned = addExercise ? workoutKcal : 0;
  const eaten = totals.kcal ?? 0;
  return {
    goals,
    entries,
    totals,
    eaten,
    burned,
    /** Whether there is any activity to show (health data or workouts entered by hand). */
    active: Boolean(activity) || workouts.length > 0,
    budget: goals.kcal + burned,
    left: goals.kcal + burned - eaten,
    activity,
    waterMl: s.water?.[date] ?? 0,
    waterGoal: s.waterGoal ?? defaultWaterGoal(s.profile?.weightKg),
  };
}
