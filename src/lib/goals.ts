import type { NutritionGoals } from './nutrition';

export type Sex = 'female' | 'male';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very';
export type GoalType = 'lose' | 'maintain' | 'gain';

export interface Profile {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: GoalType;
  /** Planned change in kg per week (for lose/gain). */
  pace: number;
  targetWeightKg?: number;
}

export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very: 1.9,
};

/** Energy in 1 kg of body fat (approx.), used to turn a weekly pace into a daily deficit. */
const KCAL_PER_KG = 7700;

/** Basal metabolic rate, Mifflin-St Jeor (1990). */
export function bmr(p: Pick<Profile, 'sex' | 'birthYear' | 'heightCm' | 'weightKg'>, year = new Date().getFullYear()): number {
  const age = year - p.birthYear;
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161);
}

export function tdee(p: Profile, year?: number): number {
  return bmr(p, year) * ACTIVITY_FACTORS[p.activity];
}

/** Daily calorie and macro goals for a profile. */
export function goalsFromProfile(p: Profile, year?: number): NutritionGoals {
  const maintenance = tdee(p, year);
  const delta = p.goal === 'maintain' ? 0 : ((p.goal === 'lose' ? -1 : 1) * p.pace * KCAL_PER_KG) / 7;
  // Never suggest less than a safe minimum without supervision.
  const floor = p.sex === 'male' ? 1500 : 1200;
  const kcal = Math.max(floor, Math.round((maintenance + delta) / 10) * 10);
  // Protein per kg body weight: more while losing to keep muscle.
  const protein = Math.round(p.weightKg * (p.goal === 'lose' ? 2 : 1.6));
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

/** Suggested daily water in ml: about 33 ml per kg, rounded to a glass. */
export function waterGoal(weightKg?: number): number {
  return weightKg ? Math.round((weightKg * 33) / 250) * 250 : 2000;
}

/** Weeks until the target weight at the chosen pace, or undefined when not applicable. */
export function weeksToTarget(p: Profile): number | undefined {
  if (!p.targetWeightKg || p.goal === 'maintain' || p.pace <= 0) return undefined;
  const diff = p.goal === 'lose' ? p.weightKg - p.targetWeightKg : p.targetWeightKg - p.weightKg;
  return diff > 0 ? Math.ceil(diff / p.pace) : undefined;
}
