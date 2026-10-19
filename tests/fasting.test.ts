import { describe, expect, it } from 'vitest';
import { fastStatus, fastingStreak, formatDuration, reachedGoal, type FastRecord } from '../src/lib/fasting';

const H = 3_600_000;
const start = new Date(2026, 9, 18, 20, 0).getTime();

describe('fastStatus', () => {
  it('reports progress, remaining time and the current stage', () => {
    const s = fastStatus(start, 16, start + 13 * H);
    expect(s.progress).toBeCloseTo(13 / 16);
    expect(s.remainingMs).toBe(3 * H);
    expect(s.endsAt).toBe(start + 16 * H);
    expect(s.done).toBe(false);
    expect(s.stage).toBe('burning');
    expect(s.next).toEqual({ id: 'deep', at: start + 16 * H });
  });

  it('starts in digestion and caps progress once the goal is reached', () => {
    expect(fastStatus(start, 16, start + 10 * 60_000).stage).toBe('digesting');
    const done = fastStatus(start, 16, start + 18 * H);
    expect(done.done).toBe(true);
    expect(done.progress).toBe(1);
    expect(done.remainingMs).toBe(0);
    expect(done.next).toBeUndefined();
  });

  it('never goes negative for a start in the future', () => {
    expect(fastStatus(start, 16, start - H).elapsedMs).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formats hours past 24', () => {
    expect(formatDuration(25 * H + 5 * 60_000 + 9_000)).toBe('25:05:09');
    expect(formatDuration(90 * 60_000, false)).toBe('1:30');
  });
});

describe('fastingStreak', () => {
  const fast = (day: number, hours: number, target = 16): FastRecord => {
    const end = new Date(2026, 9, day, 12, 0).getTime();
    return { id: `${day}`, start: end - hours * H, end, targetHours: target };
  };

  it('counts consecutive days with a completed fast', () => {
    const history = [fast(15, 16), fast(17, 16.5), fast(18, 17), fast(19, 16)];
    expect(fastingStreak(history, '2026-10-19')).toBe(3);
  });

  it('keeps the streak alive until today is over and ignores fasts that fell short', () => {
    expect(fastingStreak([fast(17, 16), fast(18, 16)], '2026-10-19')).toBe(2);
    expect(fastingStreak([fast(18, 12)], '2026-10-19')).toBe(0);
    expect(reachedGoal(fast(18, 12, 12))).toBe(true);
  });
});
