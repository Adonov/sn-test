import { describe, expect, it } from 'vitest';
import { DEFAULT_REMINDERS, planReminders, reminderRoute, type ReminderContext, type ReminderSettings } from '../src/lib/reminders';

const now = new Date(2026, 9, 19, 10, 0); // Monday 10:00
const ctx: ReminderContext = { today: '2026-10-19', loggedSlots: [], waterMl: 0, waterGoal: 2000, weighedToday: false };
const on = (patch: Partial<ReminderSettings>): ReminderSettings => ({ ...DEFAULT_REMINDERS, fastEnd: false, ...patch });
const times = (list: { at: Date }[]) => list.map((r) => `${r.at.getDate()} ${r.at.getHours()}:${String(r.at.getMinutes()).padStart(2, '0')}`);

describe('planReminders', () => {
  it('plans meals for the coming days, skipping times already past', () => {
    const plan = planReminders(on({ breakfast: { on: true, time: '08:00' }, lunch: { on: true, time: '12:30' } }), now, ctx);
    expect(times(plan).slice(0, 3)).toEqual(['19 12:30', '20 8:00', '20 12:30']);
    expect(plan.every((r, i) => r.id === i + 1)).toBe(true);
  });

  it('skips today’s reminder once the meal is logged', () => {
    const plan = planReminders(on({ lunch: { on: true, time: '12:30' } }), now, { ...ctx, loggedSlots: ['lunch'] });
    expect(times(plan)[0]).toBe('20 12:30');
  });

  it('spreads water reminders over the day and stops once the goal is reached', () => {
    const water = { on: true, from: '09:00', to: '15:00', everyHours: 2 };
    expect(times(planReminders(on({ water }), now, ctx)).slice(0, 4)).toEqual(['19 11:00', '19 13:00', '19 15:00', '20 9:00']);
    expect(times(planReminders(on({ water }), now, { ...ctx, waterMl: 2000 }))[0]).toBe('20 9:00');
  });

  it('weighs in on Mondays only when weekly', () => {
    const weekly = planReminders(on({ weigh: { on: true, time: '07:30', weekly: true } }), new Date(2026, 9, 19, 6, 0), ctx);
    expect(times(weekly)).toEqual(['19 7:30']);
    const daily = planReminders(on({ weigh: { on: true, time: '07:30', weekly: false } }), now, ctx);
    expect(daily).toHaveLength(6);
  });

  it('stays under the iOS limit and always keeps the fasting notification', () => {
    const all = on({
      breakfast: { on: true, time: '08:00' },
      lunch: { on: true, time: '12:00' },
      dinner: { on: true, time: '18:00' },
      water: { on: true, from: '08:00', to: '22:00', everyHours: 1 },
      fastEnd: true,
    });
    const plan = planReminders(all, now, { ...ctx, fastEndsAt: now.getTime() + 6 * 3_600_000 });
    expect(plan.length).toBeLessThanOrEqual(60);
    expect(plan.some((r) => r.kind === 'fastEnd')).toBe(true);
  });
});

describe('reminderRoute', () => {
  it('opens the right screen', () => {
    expect(reminderRoute('breakfast', '2026-10-20')).toBe('/nutrition/add/2026-10-20/breakfast');
    expect(reminderRoute('fastEnd', '2026-10-20')).toBe('/fasting');
    expect(reminderRoute('weigh', '2026-10-20')).toBe('/nutrition/progress');
  });
});
