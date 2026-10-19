import { describe, expect, it } from 'vitest';
import { estimateKcal, fuelGuide, kindFromHealth, needsFuelCheck, trainingAdvice, type Workout } from '../src/lib/workouts';
import { DEFAULT_REMINDERS, planReminders } from '../src/lib/reminders';

const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime(); // October 2026; the 17th is a Saturday
let n = 0;
const w = (kind: Workout['kind'], start: number, minutes: number, km?: number): Workout => ({ id: `w${++n}`, kind, start, minutes, km, source: 'manual' });

describe('trainingAdvice', () => {
  const race = w('run', at(17, 9), 52, 10); // Saturday 10 km race

  it('flags running again too soon after a 10 km race and suggests an easy ride instead', () => {
    const again = w('run', at(19, 17), 40, 7); // Monday evening run
    const advice = trainingAdvice([race, again], at(19, 19));
    expect(advice).toMatchObject({ kind: 'tooSoon', ref: race, latest: again, daysAgo: 2, hours: 72 });
  });

  it('suggests a recovery day after a hard effort when nothing is done yet', () => {
    expect(trainingAdvice([race], at(18, 8))).toMatchObject({ kind: 'recover', ref: race, daysAgo: 1 });
  });

  it('is happy with an easy ride after the race', () => {
    const ride = w('ride', at(18, 10), 40, 15);
    expect(trainingAdvice([race, ride], at(18, 12)).kind).toBe('keepGoing');
  });

  it('allows running again once recovered', () => {
    const later = w('run', at(21, 7), 40, 7); // Wednesday, 4 days later
    expect(trainingAdvice([race, later], at(21, 9)).kind).toBe('keepGoing');
  });

  it('asks for a rest day after many days in a row', () => {
    const days = [12, 13, 14, 15, 16].map((d) => w('ride', at(d, 7), 45));
    expect(trainingAdvice(days, at(17, 8))).toMatchObject({ kind: 'restDay', count: 5 });
  });

  it('warns about a sudden jump in training', () => {
    const base = [0, 7, 14].flatMap((wk) => [w('run', at(1 + wk, 7), 30), w('ride', at(3 + wk, 7), 60)]);
    const big = [w('ride', at(22, 7), 150), w('run', at(24, 7), 45), w('ride', at(26, 7), 150)];
    expect(trainingAdvice([...base, ...big], at(27, 20)).kind).toBe('rampUp');
  });

  it('nudges back after a break and suggests strength when there was none', () => {
    expect(trainingAdvice([w('walk', at(10, 7), 40)], at(17, 8))).toMatchObject({ kind: 'restart', count: 7 });
    expect(trainingAdvice([w('walk', at(16, 7), 40)], at(17, 8)).kind).toBe('strength');
    expect(trainingAdvice([], at(17, 8)).kind).toBe('start');
  });
});

describe('workout helpers', () => {
  it('maps health workout types', () => {
    expect(kindFromHealth('running')).toBe('run');
    expect(kindFromHealth('runningTreadmill')).toBe('run');
    expect(kindFromHealth('bikingStationary')).toBe('ride');
    expect(kindFromHealth('traditionalStrengthTraining')).toBe('strength');
    expect(kindFromHealth('highIntensityIntervalTraining')).toBe('hiit');
    expect(kindFromHealth('yoga')).toBe('yoga');
    expect(kindFromHealth('golf')).toBe('other');
  });

  it('estimates calories', () => {
    expect(estimateKcal('run', 50, 60, 10)).toBe(600);
    expect(estimateKcal('ride', 60, 70)).toBe(551);
  });

  it('asks about fuel after runs and rides of 30 minutes or more', () => {
    expect(needsFuelCheck(w('run', at(17, 9), 52, 10))).toBe(true);
    expect(needsFuelCheck(w('run', at(17, 9), 20, 3))).toBe(false);
    expect(needsFuelCheck(w('strength', at(17, 9), 60))).toBe(false);
  });

  it('gives carb guidance for long efforts', () => {
    expect(fuelGuide(w('run', 0, 45, 8), 60).during).toBeUndefined();
    expect(fuelGuide(w('ride', 0, 120, 50), 70)).toEqual({ during: { low: 60, high: 120, gels: 2 }, after: { carbs: 84, protein: 20 } });
    expect(fuelGuide(w('ride', 0, 240), 70).during).toEqual({ low: 240, high: 360, gels: 10 });
  });

  it('plans the fuel notification shortly after the workout', () => {
    const now = new Date(2026, 9, 17, 10, 5);
    const plan = planReminders({ ...DEFAULT_REMINDERS, fastEnd: false }, now, {
      today: '2026-10-17',
      loggedSlots: [],
      waterMl: 0,
      waterGoal: 2000,
      weighedToday: false,
      fuelChecks: [{ endedAt: at(17, 10), date: '2026-10-17' }],
    });
    expect(plan).toEqual([{ id: 1, kind: 'fuel', at: new Date(2026, 9, 17, 10, 10) }]);
  });
});
