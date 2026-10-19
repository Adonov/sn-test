import { LocalNotifications } from '@capacitor/local-notifications';
import { i18nFor } from '../i18n';
import { detectLanguage } from '../i18n/languages';
import { toISODate } from './dates';
import { fastStatus } from './fasting';
import { isNative } from './platform';
import { DEFAULT_REMINDERS, anyReminderOn, planReminders, reminderRoute, type PlannedReminder } from './reminders';
import { navigate } from './router';
import { getState, subscribe } from './store';
import { daySummary } from './today';
import type { AppState } from './types';

/** Asks for permission to show notifications (once; later calls just report the answer). */
export async function requestNotifications(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;
    if (current.display === 'denied') return false;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

function plan(s: AppState, now: Date): PlannedReminder[] {
  const settings = s.device?.reminders ?? DEFAULT_REMINDERS;
  if (!anyReminderOn(settings)) return [];
  const today = toISODate(now);
  const day = daySummary(s, today);
  return planReminders(settings, now, {
    today,
    loggedSlots: day.entries.map((e) => e.slot),
    waterMl: day.waterMl,
    waterGoal: day.waterGoal,
    weighedToday: (s.weights ?? []).some((w) => w.date === today),
    fastEndsAt: s.fasting?.start ? fastStatus(s.fasting.start, s.fasting.planHours, now.getTime()).endsAt : undefined,
  });
}

function texts(s: AppState, r: PlannedReminder): { title: string; body: string } {
  const { t } = i18nFor(s.language ?? detectLanguage());
  switch (r.kind) {
    case 'breakfast':
    case 'lunch':
    case 'dinner':
      return { title: t(`reminder.${r.kind}Title`), body: t('reminder.mealBody') };
    case 'water':
      return { title: t('reminder.waterTitle'), body: t('reminder.waterBody') };
    case 'weigh':
      return { title: t('reminder.weighTitle'), body: t('reminder.weighBody') };
    case 'fastEnd':
      return { title: t('reminder.fastTitle'), body: t('reminder.fastBody', { hours: s.fasting?.planHours ?? 16 }) };
  }
}

let last = '';
let running: Promise<void> = Promise.resolve();

/** Replaces all pending reminders with a fresh plan, if anything about the plan changed. */
function reschedule(): void {
  if (!isNative) return;
  running = running.then(async () => {
    const s = getState();
    const planned = plan(s, new Date());
    const signature = JSON.stringify([s.language, planned.map((r) => [r.kind, r.at.getTime()])]);
    if (signature === last) return;
    try {
      if (planned.length && (await LocalNotifications.checkPermissions()).display !== 'granted') return;
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      }
      if (planned.length) {
        await LocalNotifications.schedule({
          notifications: planned.map((r) => ({
            id: r.id,
            ...texts(s, r),
            schedule: { at: r.at, allowWhileIdle: true },
            // Reminders don't need to be exact to the minute; exact alarms need a special permission.
            isExactNotification: false,
            extra: { route: reminderRoute(r.kind, toISODate(r.at)) },
          })),
        });
      }
      last = signature;
    } catch (err) {
      console.warn('Could not schedule reminders', err);
    }
  });
}

export function setupReminders(): void {
  LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const route = action.notification.extra?.route;
    if (typeof route === 'string') navigate(route);
  }).catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  reschedule();
  subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(reschedule, 1500);
  });
}

/** Plans again now, e.g. after the app returns to the foreground or permission was granted. */
export function refreshReminders(): void {
  last = '';
  reschedule();
}
