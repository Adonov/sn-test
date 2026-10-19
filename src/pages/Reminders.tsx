import { useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { refreshReminders, requestNotifications } from '../lib/notify';
import { isNative } from '../lib/platform';
import { DEFAULT_REMINDERS, anyReminderOn, type ReminderSettings } from '../lib/reminders';
import { setReminders, useAppState } from '../lib/store';

export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="switch-row">
      <span>
        {label}
        {hint && <small className="muted block">{hint}</small>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="reminder-row">{children}</div>;
}

export function Reminders() {
  const { device } = useAppState();
  const { t } = useI18n();
  const r = { ...DEFAULT_REMINDERS, ...device?.reminders };
  const [denied, setDenied] = useState(false);

  const update = async (next: ReminderSettings) => {
    setReminders(next);
    if (anyReminderOn(next)) {
      setDenied(!(await requestNotifications()));
      refreshReminders();
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>{t('reminders.title')}</h1>
      </header>
      <p className="muted">{t('reminders.intro')}</p>
      {!isNative && <p className="notice">{t('reminders.appOnly')}</p>}
      {denied && <p className="notice">{t('reminders.denied')}</p>}

      <section className="card">
        <h2>{t('reminders.meals')}</h2>
        {(['breakfast', 'lunch', 'dinner'] as const).map((slot) => (
          <Row key={slot}>
            <Switch label={t(`slot.${slot}`)} checked={r[slot].on} onChange={(on) => update({ ...r, [slot]: { ...r[slot], on } })} />
            <input
              type="time"
              aria-label={`${t(`slot.${slot}`)} – ${t('reminders.time')}`}
              value={r[slot].time}
              disabled={!r[slot].on}
              onChange={(e) => update({ ...r, [slot]: { ...r[slot], time: e.target.value } })}
            />
          </Row>
        ))}
        <p className="muted small">{t('reminders.smart')}</p>
      </section>

      <section className="card">
        <h2>{t('water.title')}</h2>
        <Switch label={t('reminders.water')} checked={r.water.on} onChange={(on) => update({ ...r, water: { ...r.water, on } })} />
        {r.water.on && (
          <>
            <div className="grid-2">
              <label className="field">
                <span>{t('reminders.from')}</span>
                <input type="time" value={r.water.from} onChange={(e) => update({ ...r, water: { ...r.water, from: e.target.value } })} />
              </label>
              <label className="field">
                <span>{t('reminders.to')}</span>
                <input type="time" value={r.water.to} onChange={(e) => update({ ...r, water: { ...r.water, to: e.target.value } })} />
              </label>
            </div>
            <div className="chips">
              {[1, 2, 3].map((h) => (
                <button
                  key={h}
                  className={`chip ${r.water.everyHours === h ? 'active' : ''}`}
                  onClick={() => update({ ...r, water: { ...r.water, everyHours: h } })}
                >
                  {t('reminders.every', { count: h })}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2>{t('progress.weight')}</h2>
        <Row>
          <Switch label={t('reminders.weigh')} checked={r.weigh.on} onChange={(on) => update({ ...r, weigh: { ...r.weigh, on } })} />
          <input
            type="time"
            aria-label={`${t('reminders.weigh')} – ${t('reminders.time')}`}
            value={r.weigh.time}
            disabled={!r.weigh.on}
            onChange={(e) => update({ ...r, weigh: { ...r.weigh, time: e.target.value } })}
          />
        </Row>
        {r.weigh.on && (
          <div className="chips">
            <button className={`chip ${!r.weigh.weekly ? 'active' : ''}`} onClick={() => update({ ...r, weigh: { ...r.weigh, weekly: false } })}>
              {t('reminders.daily')}
            </button>
            <button className={`chip ${r.weigh.weekly ? 'active' : ''}`} onClick={() => update({ ...r, weigh: { ...r.weigh, weekly: true } })}>
              {t('reminders.weekly')}
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>{t('fasting.title')}</h2>
        <Switch label={t('reminders.fastEnd')} checked={r.fastEnd} onChange={(fastEnd) => update({ ...r, fastEnd })} />
      </section>

      <section className="card">
        <h2>{t('training.title')}</h2>
        <Switch label={t('reminders.fuelCheck')} hint={t('reminders.fuelCheckHint')} checked={r.fuelCheck} onChange={(fuelCheck) => update({ ...r, fuelCheck })} />
      </section>
    </>
  );
}
