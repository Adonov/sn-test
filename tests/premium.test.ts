import { describe, expect, it } from 'vitest';
import { aiLeft, aiWeek, FREE_AI_PER_WEEK } from '../src/lib/premium';

const wed = new Date(2026, 9, 21, 12);

describe('aiWeek', () => {
  it('is the Monday of the week', () => {
    expect(aiWeek(wed)).toBe('2026-10-19');
    expect(aiWeek(new Date(2026, 9, 25, 23))).toBe('2026-10-19');
    expect(aiWeek(new Date(2026, 9, 26, 0, 1))).toBe('2026-10-26');
  });
});

describe('aiLeft', () => {
  it('has no limit while subscriptions are not sold', () => {
    expect(aiLeft({ device: { aiUsage: { week: '2026-10-19', used: 50 } } }, wed, false)).toBe(Infinity);
  });

  it('has no limit with Premium', () => {
    expect(aiLeft({ device: { premium: true, aiUsage: { week: '2026-10-19', used: 50 } } }, wed, true)).toBe(Infinity);
  });

  it('counts this week only', () => {
    expect(aiLeft({}, wed, true)).toBe(FREE_AI_PER_WEEK);
    expect(aiLeft({ device: { aiUsage: { week: '2026-10-19', used: 2 } } }, wed, true)).toBe(FREE_AI_PER_WEEK - 2);
    expect(aiLeft({ device: { aiUsage: { week: '2026-10-12', used: 5 } } }, wed, true)).toBe(FREE_AI_PER_WEEK);
    expect(aiLeft({ device: { aiUsage: { week: '2026-10-19', used: 9 } } }, wed, true)).toBe(0);
  });
});
