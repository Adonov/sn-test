import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/persistence', () => ({ loadSaved: async () => null, save: () => true }));

import { widgetSnapshot } from '../src/lib/widget';
import type { AppState } from '../src/lib/types';

describe('widgetSnapshot', () => {
  it('summarizes today with workout calories, water and the running fast', () => {
    const s: AppState = {
      version: 1,
      language: 'sl',
      recipes: [],
      plan: [],
      grocery: [],
      nutritionGoals: { kcal: 2000, protein: 120, carbs: 200, fat: 70 },
      waterGoal: 2200,
      water: { '2026-10-19': 750 },
      diary: [
        {
          id: '1',
          date: '2026-10-19',
          slot: 'breakfast',
          name: 'Ovsena kaša',
          amount: 1,
          unit: 'serving',
          perUnit: { kcal: 400.4, protein: 15, carbs: 60, fat: 9 },
          source: 'manual',
          createdAt: 1,
        },
      ],
      fasting: { planHours: 16, start: Date.UTC(2026, 9, 18, 20), history: [] },
      device: { health: { enabled: true, addExercise: true }, activity: { '2026-10-19': { steps: 5000, exerciseKcal: 320 } } },
    };
    const snap = widgetSnapshot(s, new Date(2026, 9, 19, 9));
    expect(snap).toMatchObject({
      date: '2026-10-19',
      eaten: 400,
      goal: 2000,
      burned: 320,
      protein: [15, 120],
      waterMl: 750,
      waterGoal: 2200,
      fastStart: Date.UTC(2026, 9, 18, 20) / 1000,
      fastHours: 16,
    });
    expect(snap.labels.fasting).toBe('Postenje');
    expect(snap.labels.left).toBe('kcal še');
  });

  it('ignores workout calories when Apple Health isn’t connected', () => {
    const s: AppState = {
      version: 1,
      recipes: [],
      plan: [],
      grocery: [],
      device: { health: { enabled: false, addExercise: true }, activity: { '2026-10-19': { exerciseKcal: 320 } } },
    };
    expect(widgetSnapshot(s, new Date(2026, 9, 19, 9)).burned).toBe(0);
  });
});
