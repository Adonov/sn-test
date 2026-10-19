import { Capacitor, registerPlugin } from '@capacitor/core';
import { i18nFor } from '../i18n';
import { detectLanguage } from '../i18n/languages';
import { toISODate } from './dates';
import { DEFAULT_FAST_HOURS } from './fasting';
import { getState, subscribe } from './store';
import { daySummary } from './today';
import type { AppState } from './types';

/** Read by the iOS widgets (ios/App/TaistyWidget). Keep the field names in sync with Snapshot there. */
export interface WidgetSnapshot {
  date: string;
  eaten: number;
  goal: number;
  burned: number;
  protein: [number, number];
  carbs: [number, number];
  fat: [number, number];
  waterMl: number;
  waterGoal: number;
  /** Seconds since 1970. */
  fastStart: number | null;
  fastHours: number;
  labels: Record<string, string>;
}

export function widgetSnapshot(s: AppState, now: Date): WidgetSnapshot {
  const { t } = i18nFor(s.language ?? detectLanguage());
  const date = toISODate(now);
  const day = daySummary(s, date);
  const round = (n: number | undefined) => Math.round(n ?? 0);
  return {
    date,
    eaten: round(day.eaten),
    goal: day.goals.kcal,
    burned: round(day.burned),
    protein: [round(day.totals.protein), day.goals.protein],
    carbs: [round(day.totals.carbs), day.goals.carbs],
    fat: [round(day.totals.fat), day.goals.fat],
    waterMl: day.waterMl,
    waterGoal: day.waterGoal,
    fastStart: s.fasting?.start ? Math.floor(s.fasting.start / 1000) : null,
    fastHours: s.fasting?.planHours ?? DEFAULT_FAST_HOURS,
    labels: {
      today: t('detail.today'),
      left: t('widget.left'),
      over: t('widget.over'),
      protein: t('nutrient.protein'),
      carbs: t('nutrient.carbs'),
      fat: t('nutrient.fat'),
      water: t('water.title'),
      fasting: t('fasting.title'),
      notFasting: t('fasting.notFasting'),
      startFast: t('fasting.start'),
      ends: t('widget.ends'),
    },
  };
}

interface WidgetBridge {
  update(options: { snapshot: string }): Promise<void>;
}

/** Keeps the iOS home screen widgets up to date with the diary and the fasting timer. */
export function setupWidgets(): void {
  if (Capacitor.getPlatform() !== 'ios') return;
  const bridge = registerPlugin<WidgetBridge>('WidgetBridge');
  let last = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const push = () => {
    const snapshot = JSON.stringify(widgetSnapshot(getState(), new Date()));
    if (snapshot === last) return;
    last = snapshot;
    bridge.update({ snapshot }).catch(() => {});
  };
  push();
  subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(push, 500);
  });
}
