import { describe, expect, it } from 'vitest';
import { activityFromHealth, mergeScaleWeights } from '../src/lib/health';
import type { WeightEntry } from '../src/lib/nutrition';

const iso = (d: number, h = 12) => new Date(2026, 9, d, h).toISOString();
let n = 0;
const newId = () => `id${++n}`;

describe('activityFromHealth', () => {
  it('sums steps and workouts per local day', () => {
    const days = activityFromHealth(
      [
        { startDate: iso(18, 0), value: 8123.4 },
        { startDate: iso(19, 0), value: 4000 },
      ],
      [
        { startDate: iso(19, 7), duration: 1800, totalEnergyBurned: 250.4 },
        { startDate: iso(19, 18), duration: 2700, totalEnergyBurned: 300 },
        { startDate: iso(18, 9), duration: 600 },
      ],
    );
    expect(days['2026-10-18']).toEqual({ steps: 8123, exerciseKcal: 0, exerciseMinutes: 10 });
    expect(days['2026-10-19']).toEqual({ steps: 4000, exerciseKcal: 550, exerciseMinutes: 75 });
  });
});

describe('mergeScaleWeights', () => {
  const manual: WeightEntry = { id: 'm', date: '2026-10-18', kg: 70 };

  it('adds the last reading of each day but keeps weights entered by hand', () => {
    const merged = mergeScaleWeights(
      [manual],
      [
        { startDate: iso(18, 7), value: 69.4 },
        { startDate: iso(19, 7), value: 69.66 },
        { startDate: iso(19, 6), value: 69.9 },
      ],
      newId,
    );
    expect(merged).toEqual([manual, { id: expect.any(String), date: '2026-10-19', kg: 69.7, source: 'health' }]);
  });

  it('returns undefined when nothing changes', () => {
    const fromScale: WeightEntry = { id: 'h', date: '2026-10-19', kg: 69.7, source: 'health' };
    expect(mergeScaleWeights([fromScale], [{ startDate: iso(19, 7), value: 69.7 }], newId)).toBeUndefined();
    expect(mergeScaleWeights([fromScale], [{ startDate: iso(19, 7), value: 69.2 }], newId)?.[0]).toMatchObject({ id: 'h', kg: 69.2 });
  });
});
