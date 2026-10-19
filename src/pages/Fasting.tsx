import { useState, type FormEvent } from 'react';
import { BarChart } from '../components/Charts';
import { Modal } from '../components/Modal';
import { Ring } from '../components/Ring';
import { useI18n } from '../i18n';
import { addDays, toISODate } from '../lib/dates';
import {
  DEFAULT_FAST_HOURS,
  FASTING_PLANS,
  FAST_STAGES,
  fastStatus,
  fastingStreak,
  formatDuration,
  reachedGoal,
} from '../lib/fasting';
import { refreshReminders, requestNotifications } from '../lib/notify';
import { endFast, setFastStart, setFastingPlan, startFast, useAppState } from '../lib/store';
import { useNow } from '../lib/useNow';

const HOUR = 3_600_000;

/** Value for <input type="datetime-local"> in local time. */
function toLocalInput(ms: number): string {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

export function Fasting() {
  const { fasting, device } = useAppState();
  const { t, lang } = useI18n();
  const f = fasting ?? { planHours: DEFAULT_FAST_HOURS, history: [] };
  const now = useNow(1000, Boolean(f.start));
  const status = f.start ? fastStatus(f.start, f.planHours, now) : undefined;
  const [editing, setEditing] = useState(false);
  const today = toISODate(new Date(now));
  const streak = fastingStreak(f.history, today);
  const time = (ms: number) => new Date(ms).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  const plan = (h: number) => `${h}:${24 - h}`;

  const start = async () => {
    startFast();
    // The "fast complete" notification needs permission; ask when it is first useful.
    if (device?.reminders?.fastEnd ?? true) {
      await requestNotifications();
      refreshReminders();
    }
  };

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = toISODate(addDays(new Date(now), i - 6));
    const fasts = f.history.filter((x) => toISODate(new Date(x.end)) === date);
    const hours = Math.max(0, ...fasts.map((x) => (x.end - x.start) / HOUR));
    return { date, hours, reached: fasts.some(reachedGoal) };
  });

  return (
    <>
      <header className="page-header">
        <h1>{t('fasting.title')}</h1>
        {streak > 0 && <span className="streak">{t('streak.days', { count: streak })}</span>}
      </header>

      <section className="card fasting-hero">
        <Ring progress={status?.progress ?? 0} size={232} stroke={14} tone="blue">
          {status ? (
            <>
              <div className="ring-label">{status.done ? t('fasting.goalReached') : t('fasting.elapsed')}</div>
              <div className="ring-value fast-timer" role="timer" aria-live="off">
                {formatDuration(status.elapsedMs)}
              </div>
              <div className="ring-label">
                {status.done
                  ? t('fasting.extra', { time: formatDuration(status.elapsedMs - status.targetMs, false) })
                  : t('fasting.remaining', { time: formatDuration(status.remainingMs, false) })}
              </div>
            </>
          ) : (
            <>
              <div className="ring-value">{plan(f.planHours)}</div>
              <div className="ring-label">{t('fasting.notFasting')}</div>
            </>
          )}
        </Ring>

        {status && f.start && (
          <div className="fast-times">
            <button className="fast-time" onClick={() => setEditing(true)}>
              <small>{t('fasting.started')}</small>
              <b>{time(f.start)}</b>
              <span className="link-btn small">{t('fasting.edit')}</span>
            </button>
            <div className="fast-time">
              <small>{t('fasting.goal')}</small>
              <b>{time(status.endsAt)}</b>
              <span className="muted small">{t('fasting.hours', { count: f.planHours })}</span>
            </div>
          </div>
        )}

        {status ? (
          <button className={`btn wide ${status.done ? 'primary' : ''}`} onClick={() => endFast()}>
            {t('fasting.end')}
          </button>
        ) : (
          <button className="btn primary wide" onClick={start}>
            {t('fasting.start')}
          </button>
        )}
      </section>

      {status && (
        <section className="card">
          <div className="section-head">
            <h2>{t(`fastStage.${status.stage}`)}</h2>
          </div>
          <p className="muted">{t(`fastStage.${status.stage}Text`)}</p>
          <ol className="stage-track" aria-label={t('fasting.stages')}>
            {FAST_STAGES.map((s) => {
              const reached = status.elapsedMs >= s.fromHours * HOUR;
              return (
                <li key={s.id} className={`${reached ? 'reached' : ''} ${s.id === status.stage ? 'current' : ''}`}>
                  <span className="dot" aria-hidden />
                  <span>{t(`fastStage.${s.id}`)}</span>
                  <small className="muted">{s.fromHours} h</small>
                </li>
              );
            })}
          </ol>
          {status.next && <p className="small muted">{t('fasting.next', { stage: t(`fastStage.${status.next.id}`), time: time(status.next.at) })}</p>}
        </section>
      )}

      <section className="card">
        <h2>{t('fasting.plan')}</h2>
        <div className="plan-grid" role="radiogroup" aria-label={t('fasting.plan')}>
          {FASTING_PLANS.map((h) => (
            <button
              key={h}
              role="radio"
              aria-checked={h === f.planHours}
              className={`plan-card ${h === f.planHours ? 'active' : ''}`}
              onClick={() => setFastingPlan(h)}
            >
              <b>{plan(h)}</b>
              <small>{t(`fastPlan.${h}`)}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>{t('fasting.week')}</h2>
        {f.history.length ? (
          <BarChart
            title={t('fasting.week')}
            reference={f.planHours}
            referenceLabel={`${t('progress.goalLabel')} ${f.planHours} h`}
            data={week.map((d) => ({
              label: new Date(`${d.date}T12:00`).toLocaleDateString(lang, { weekday: 'narrow' }),
              value: Math.round(d.hours * 10) / 10,
              highlight: d.date === today,
              detail: d.hours ? `${formatDuration(d.hours * HOUR, false)} h${d.reached ? ' ✓' : ''}` : '—',
            }))}
          />
        ) : (
          <p className="muted">{t('fasting.noHistory')}</p>
        )}
      </section>

      <p className="muted small">{t('fasting.disclaimer')}</p>

      {editing && f.start && <EditStart start={f.start} onClose={() => setEditing(false)} />}
    </>
  );
}

function EditStart({ start, onClose }: { start: number; onClose: () => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState(toLocalInput(start));
  const parsed = new Date(value).getTime();
  const valid = Number.isFinite(parsed) && parsed <= Date.now();
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setFastStart(parsed);
    onClose();
  };
  return (
    <Modal title={t('fasting.editTitle')} onClose={onClose}>
      <form onSubmit={save}>
        <label className="field">
          <span>{t('fasting.lastMeal')}</span>
          <input type="datetime-local" value={value} max={toLocalInput(Date.now())} onChange={(e) => setValue(e.target.value)} autoFocus />
        </label>
        <div className="action-row">
          <button className="btn primary" disabled={!valid}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
