import { useEffect, useState, type FormEvent } from 'react';
import { BarChart } from '../components/Charts';
import { CoachCard, FuelCheck, describeWorkout } from '../components/Coach';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n';
import { addDays, fromISODate, toISODate } from '../lib/dates';
import { addWorkout, allWorkouts, removeWorkout, useAppState } from '../lib/store';
import { DISTANCE_KINDS, WORKOUT_KINDS, estimateKcal, needsFuelCheck, workoutPace, type Workout, type WorkoutKind } from '../lib/workouts';
import { syncHealth } from '../lib/healthSync';
import { syncStrava } from '../lib/strava';
import { healthName } from './Health';

const DAY = 86_400_000;
const num = (v: string) => Number(v.replace(',', '.'));
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function Training() {
  const state = useAppState();
  const { t, lang, decimal } = useI18n();
  const workouts = allWorkouts(state);
  const connected = Boolean(state.device?.strava && !state.device.strava.error) || Boolean(state.device?.health?.enabled);

  useEffect(() => {
    syncHealth();
    syncStrava();
  }, []);

  const details = (w: Workout) =>
    [
      new Date(w.start).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' }),
      `${w.minutes} min`,
      workoutPace(w, decimal),
      w.heartRate && `♥ ${w.heartRate}`,
      w.elevationM && `↑ ${w.elevationM} m`,
      w.kcal && `${w.kcal} kcal`,
      w.source === 'health' ? healthName() : w.source === 'strava' ? 'Strava' : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
  const checked = new Set(state.device?.fuelChecked ?? []);
  const now = Date.now();
  const toCheck = workouts.filter((w) => needsFuelCheck(w) && !checked.has(w.id) && now - w.start < 1.5 * DAY);
  const recent = workouts.filter((w) => now - w.start < 14 * DAY).reverse();
  const today = toISODate(new Date());
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = toISODate(addDays(new Date(), i - 6));
    const minutes = workouts.filter((w) => toISODate(new Date(w.start)) === date).reduce((s, w) => s + w.minutes, 0);
    return { date, minutes };
  });

  return (
    <>
      <header className="page-header">
        <h1>{t('training.title')}</h1>
      </header>

      <CoachCard workouts={workouts} />
      {toCheck.map((w) => (
        <FuelCheck key={w.id} workout={w} />
      ))}

      <AddWorkout />
      {!connected && (
        <a className="card link-card" href="#/connections">
          <span className="grow">
            <b>{t('connections.cta')}</b>
            <small className="muted block">{t('connections.ctaText')}</small>
          </span>
          <span className="flip muted" aria-hidden>
            <Icon name="back" size={18} />
          </span>
        </a>
      )}

      <section className="card">
        <h2>{t('training.week')}</h2>
        <BarChart
          title={t('training.week')}
          data={week.map((d) => ({
            label: fromISODate(d.date).toLocaleDateString(lang, { weekday: 'narrow' }),
            value: d.minutes,
            highlight: d.date === today,
            detail: `${d.minutes} min`,
          }))}
        />
      </section>

      <section className="card">
        <h2>{t('training.recent')}</h2>
        {recent.length ? (
          <ul className="food-list">
            {recent.map((w) => (
              <li key={w.id} className="workout-row">
                <span className="grow">
                  {capitalize(describeWorkout(w, t, decimal))}
                  <small className="muted block">{details(w)}</small>
                </span>
                {w.source === 'manual' && (
                  <button className="icon-btn small" onClick={() => removeWorkout(w.id)} aria-label={t('common.remove')}>
                    <Icon name="trash" size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('training.none')}</p>
        )}
      </section>

      <p className="muted small">{t('training.disclaimer')}</p>
    </>
  );
}

function AddWorkout() {
  const { profile, weights = [] } = useAppState();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WorkoutKind>('run');
  const [date, setDate] = useState(toISODate(new Date()));
  const [minutes, setMinutes] = useState('');
  const [km, setKm] = useState('');
  const weight = weights[weights.length - 1]?.kg ?? profile?.weightKg;
  const mins = num(minutes);
  const dist = DISTANCE_KINDS.includes(kind) && num(km) > 0 ? num(km) : undefined;
  const valid = mins > 0 && mins <= 1440;
  const kcal = valid ? estimateKcal(kind, mins, weight, dist) : 0;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    // A workout logged for today ends now; for another day it is placed in the morning.
    const end = date === toISODate(new Date()) ? Date.now() : fromISODate(date).getTime() + 9 * 3_600_000 + mins * 60_000;
    addWorkout({ kind, start: end - mins * 60_000, minutes: Math.round(mins), km: dist, kcal });
    setMinutes('');
    setKm('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="btn wide" onClick={() => setOpen(true)}>
        <Icon name="plus" size={18} /> {t('training.add')}
      </button>
    );
  }
  return (
    <form className="card" onSubmit={save}>
      <h2>{t('training.add')}</h2>
      <div className="chips wrap">
        {WORKOUT_KINDS.map((k) => (
          <button type="button" key={k} className={`chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
            {t(`workout.${k}`)}
          </button>
        ))}
      </div>
      <div className="grid-3">
        <label className="field">
          <span>{t('training.date')}</span>
          <input type="date" value={date} max={toISODate(new Date())} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('training.minutes')}</span>
          <input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="45" autoFocus />
        </label>
        {DISTANCE_KINDS.includes(kind) && (
          <label className="field">
            <span>{t('training.km')}</span>
            <input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="10" />
          </label>
        )}
      </div>
      {valid && <p className="muted small">{t('training.kcalEstimate', { kcal })}</p>}
      <div className="action-row">
        <button className="btn primary" disabled={!valid}>
          {t('training.save')}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          {t('editor.cancel')}
        </button>
      </div>
    </form>
  );
}
