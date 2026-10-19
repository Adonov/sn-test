import { useState } from 'react';
import { useI18n, type Translate } from '../i18n';
import { toISODate } from '../lib/dates';
import { slotForNow } from '../pages/AddFood';
import { addDiaryEntries, addWater, markFuelChecked, updateDiaryEntry, useAppState } from '../lib/store';
import { FUEL_ITEMS, fuelGuide, trainingAdvice, type Workout } from '../lib/workouts';
import { Icon } from './Icon';

/** "10 km run", "45 min ride"… in the UI language. */
export function describeWorkout(w: Workout, t: Translate, decimal: string): string {
  const distance = w.km ? `${String(w.km).replace('.', decimal)} km` : `${w.minutes} min`;
  return t('coach.ref', { noun: t(`workoutNoun.${w.kind}`), distance });
}

function ago(days: number, t: Translate): string {
  return days <= 0 ? t('coach.ago.today') : days === 1 ? t('coach.ago.yesterday') : t('coach.ago.days', { count: days });
}

/** Today's suggestion: rest, recover, or what kind of session fits. */
export function CoachCard({ workouts, compact = false }: { workouts: Workout[]; compact?: boolean }) {
  const { profile } = useAppState();
  const { t, decimal } = useI18n();
  const advice = trainingAdvice(workouts, Date.now(), profile?.goal);
  const params = {
    ref: advice.ref ? describeWorkout(advice.ref, t, decimal) : '',
    latest: advice.latest ? describeWorkout(advice.latest, t, decimal) : '',
    when: advice.daysAgo !== undefined ? ago(advice.daysAgo, t) : '',
    days: advice.daysAgo !== undefined ? t('coach.days', { count: advice.daysAgo }) : '',
    hours: advice.hours ?? 0,
    count: advice.count ?? 0,
  };
  const warn = advice.kind === 'tooSoon' || advice.kind === 'recover' || advice.kind === 'restDay' || advice.kind === 'rampUp';
  const body = (
    <>
      <span className={`coach-icon ${warn ? 'warn' : ''}`} aria-hidden>
        <Icon name="sparkle" size={20} />
      </span>
      <span className="grow">
        <small className="muted block">{t('training.coach')}</small>
        <b>{t(`coach.${advice.kind}.title`, params)}</b>
        <span className="block coach-text">{t(`coach.${advice.kind}.text`, params)}</span>
      </span>
    </>
  );
  return compact ? (
    <a className="card coach-card" href="#/training">
      {body}
    </a>
  ) : (
    <section className="card coach-card">{body}</section>
  );
}

/** After a run or ride: did you eat or drink? Logs gels, drinks and snacks in a tap. */
export function FuelCheck({ workout }: { workout: Workout }) {
  const { profile, weights = [] } = useAppState();
  const { t, decimal } = useI18n();
  const [counts, setCounts] = useState<Record<string, number>>({});
  // Diary entry per item, so a second gel becomes "2 ×" instead of another row.
  const [entryIds, setEntryIds] = useState<Record<string, string>>({});
  const weight = weights[weights.length - 1]?.kg ?? profile?.weightKg;
  const guide = fuelGuide(workout, weight);
  const date = toISODate(new Date(workout.start));
  const ref = describeWorkout(workout, t, decimal);

  const add = (id: (typeof FUEL_ITEMS)[number]['id']) => {
    const item = FUEL_ITEMS.find((f) => f.id === id)!;
    const count = (counts[id] ?? 0) + 1;
    if (item.kcal > 0 && entryIds[id]) {
      updateDiaryEntry(entryIds[id], { amount: count });
    } else if (item.kcal > 0) {
      const [entryId] = addDiaryEntries([
        {
          date,
          slot: slotForNow(new Date(workout.start + workout.minutes * 60_000)),
          name: t(`fuel.item.${id}`),
          amount: 1,
          unit: 'serving',
          perUnit: { kcal: item.kcal, carbs: item.carbs, protein: item.protein, fat: item.fat },
          source: 'manual',
        },
      ]);
      setEntryIds((e) => ({ ...e, [id]: entryId }));
    }
    if (item.waterMl) addWater(date, item.waterMl);
    setCounts((c) => ({ ...c, [id]: count }));
  };

  const logged = Object.values(counts).reduce((s, n) => s + n, 0);
  return (
    <section className="card fuel-card">
      <h2>{t('fuel.title', { ref })}</h2>
      <p className="muted small">{t('fuel.text')}</p>
      <div className="fuel-grid">
        {FUEL_ITEMS.map((f) => (
          <button key={f.id} className={`fuel-item ${counts[f.id] ? 'active' : ''}`} onClick={() => add(f.id)}>
            <span>
              {t(`fuel.item.${f.id}`)}
              <small className="muted block">{f.kcal ? `${f.kcal} kcal · ${f.carbs} g` : '500 ml'}</small>
            </span>
            {counts[f.id] ? <span className="fuel-count">×{counts[f.id]}</span> : <Icon name="plus" size={18} />}
          </button>
        ))}
      </div>
      {guide.during && <p className="small">{t('fuel.during', guide.during)}</p>}
      <p className="small">{t('fuel.after', guide.after)}</p>
      <div className="action-row">
        <button className="btn primary" onClick={() => markFuelChecked(workout.id)}>
          {logged ? t('fuel.done') : t('fuel.nothing')}
        </button>
        <a className="btn" href={`#/nutrition/add/${date}/snack`} onClick={() => markFuelChecked(workout.id)}>
          {t('fuel.other')}
        </a>
      </div>
    </section>
  );
}
