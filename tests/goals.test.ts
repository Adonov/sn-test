import { describe, expect, it } from 'vitest';
import { bmr, goalsFromProfile, waterGoal, weeksToTarget, type Profile } from '../src/lib/goals';

const woman: Profile = { sex: 'female', birthYear: 1996, heightCm: 168, weightKg: 65, activity: 'light', goal: 'maintain', pace: 0.5 };

describe('goals', () => {
  it('uses Mifflin-St Jeor for BMR', () => {
    // 10*65 + 6.25*168 - 5*30 - 161 = 1389
    expect(bmr(woman, 2026)).toBe(1389);
    expect(bmr({ ...woman, sex: 'male' }, 2026)).toBe(1555);
  });

  it('turns a profile into calorie and macro goals', () => {
    const g = goalsFromProfile(woman, 2026);
    expect(g.kcal).toBe(1910); // 1389 * 1.375 ≈ 1910
    expect(g.protein).toBe(104);
    expect(g.protein * 4 + g.carbs * 4 + g.fat * 9).toBeGreaterThan(g.kcal - 15);
    expect(g.protein * 4 + g.carbs * 4 + g.fat * 9).toBeLessThan(g.kcal + 15);
  });

  it('adds a deficit for weight loss, but never below the safe minimum', () => {
    expect(goalsFromProfile({ ...woman, goal: 'lose', pace: 0.5 }, 2026).kcal).toBe(1360);
    expect(goalsFromProfile({ ...woman, goal: 'lose', pace: 1, activity: 'sedentary' }, 2026).kcal).toBe(1200);
    expect(goalsFromProfile({ ...woman, goal: 'gain', pace: 0.25 }, 2026).kcal).toBe(2180);
  });

  it('estimates water and time to target', () => {
    expect(waterGoal(65)).toBe(2250);
    expect(waterGoal()).toBe(2000);
    expect(weeksToTarget({ ...woman, goal: 'lose', pace: 0.5, targetWeightKg: 60 })).toBe(10);
    expect(weeksToTarget(woman)).toBeUndefined();
  });
});
