import { describe, expect, it } from 'vitest';
import type { FoodLogEntry } from '../src/lib/nutrition';
import { dailyTotals, loggingStreak, recentFoods } from '../src/lib/nutritionStats';

const e = (date: string, name = 'x', kcal = 100, createdAt = 1): FoodLogEntry => ({
  id: `${date}-${name}-${createdAt}`,
  date,
  slot: 'lunch',
  name,
  amount: 1,
  unit: 'serving',
  perUnit: { kcal, protein: 10 },
  source: 'manual',
  createdAt,
});

describe('nutrition stats', () => {
  it('counts the logging streak, tolerating an empty today', () => {
    const diary = [e('2026-10-17'), e('2026-10-18'), e('2026-10-19')];
    expect(loggingStreak(diary, '2026-10-19')).toBe(3);
    expect(loggingStreak(diary, '2026-10-20')).toBe(3);
    expect(loggingStreak(diary, '2026-10-22')).toBe(0);
  });

  it('sums each day of the week, including empty days', () => {
    const totals = dailyTotals([e('2026-10-18', 'a', 300), e('2026-10-18', 'b', 200), e('2026-10-19', 'c', 50)], '2026-10-19', 3);
    expect(totals.map((d) => [d.date, d.kcal, d.logged])).toEqual([
      ['2026-10-17', 0, false],
      ['2026-10-18', 500, true],
      ['2026-10-19', 50, true],
    ]);
  });

  it('lists distinct recent foods, newest first', () => {
    const diary = [e('2026-10-18', 'Jogurt', 100, 1), e('2026-10-19', 'Banana', 90, 3), e('2026-10-19', 'jogurt', 100, 2)];
    expect(recentFoods(diary).map((f) => f.name)).toEqual(['Banana', 'jogurt']);
  });
});
