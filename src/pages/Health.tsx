import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useI18n } from '../i18n';
import { toISODate } from '../lib/dates';
import { healthAvailable, openHealthSettings, requestHealthAccess } from '../lib/health';
import { syncHealth } from '../lib/healthSync';
import { isNative } from '../lib/platform';
import { setHealthSettings, useAppState } from '../lib/store';
import { Switch } from './Reminders';

export const healthName = () => (Capacitor.getPlatform() === 'android' ? 'Health Connect' : 'Apple Health');

export function Health() {
  const { device } = useAppState();
  const { t, lang } = useI18n();
  const health = device?.health;
  const [available, setAvailable] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const today = device?.activity?.[toISODate(new Date())];
  const name = healthName();
  const isAndroid = Capacitor.getPlatform() === 'android';

  useEffect(() => {
    healthAvailable().then(setAvailable);
    syncHealth();
  }, []);

  const connect = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (!(await requestHealthAccess())) {
        setError(t(isAndroid ? 'health.installConnect' : 'health.unavailable'));
        return;
      }
      setHealthSettings({ enabled: true });
      await syncHealth();
    } catch (err) {
      console.warn(err);
      setError(t('health.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>{name}</h1>
      </header>
      <p className="muted">{t('health.intro', { name })}</p>

      <section className="card">
        <h2>{t('health.reads')}</h2>
        <ul className="check-list">
          <li>{t('health.steps')}</li>
          <li>{t('health.workouts')}</li>
          <li>{t('health.weight')}</li>
        </ul>
        <p className="muted small">{t('health.private')}</p>

        {!isNative ? (
          <p className="notice">{t('health.appOnly')}</p>
        ) : health?.enabled ? (
          <>
            <p className="notice success">{t('health.connected', { name })}</p>
            {today && (
              <div className="stat-row">
                <div>
                  <b>{(today.steps ?? 0).toLocaleString(lang)}</b>
                  <small className="muted">{t('health.stepsToday')}</small>
                </div>
                <div>
                  <b>{today.exerciseKcal ?? 0} kcal</b>
                  <small className="muted">{t('health.burnedToday')}</small>
                </div>
                <div>
                  <b>{today.exerciseMinutes ?? 0} min</b>
                  <small className="muted">{t('health.exercise')}</small>
                </div>
              </div>
            )}
            {health.lastSync && (
              <p className="muted small">
                {t('health.lastSync', { time: new Date(health.lastSync).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) })}
              </p>
            )}
            <div className="action-row">
              <button className="btn" onClick={() => syncHealth()}>
                {t('health.syncNow')}
              </button>
              {isAndroid && (
                <button className="btn" onClick={() => openHealthSettings()}>
                  {t('health.manage')}
                </button>
              )}
              <button className="btn danger" onClick={() => setHealthSettings({ enabled: false })}>
                {t('health.disconnect')}
              </button>
            </div>
            {!isAndroid && <p className="muted small">{t('health.iosManage')}</p>}
          </>
        ) : (
          <button className="btn primary" onClick={connect} disabled={busy || available === false}>
            {t('health.connect', { name })}
          </button>
        )}
        {available === false && isNative && !health?.enabled && (
          <p className="notice">{t(isAndroid ? 'health.installConnect' : 'health.unavailable')}</p>
        )}
        {error && <p className="notice">{error}</p>}
      </section>

      {health?.enabled && (
        <section className="card">
          <Switch
            label={t('health.addExercise')}
            hint={t('health.addExerciseHint')}
            checked={health.addExercise}
            onChange={(addExercise) => setHealthSettings({ addExercise })}
          />
        </section>
      )}
    </>
  );
}
