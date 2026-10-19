import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { isNative } from '../lib/platform';
import { connectStrava, disconnectStrava, syncStrava, useStravaConfig } from '../lib/strava';
import { useAppState } from '../lib/store';
import { healthName } from './Health';

const OTHER_APPS = ['Garmin Connect', 'Polar Flow', 'Suunto', 'COROS', 'Wahoo', 'Zwift', 'Nike Run Club', 'Peloton', 'Fitbit', 'Samsung Health', 'Apple Watch'];

/** Strava, Apple Health / Health Connect and the apps that reach tAIsty through them. */
export function Connections() {
  const { device } = useAppState();
  const { t, lang } = useI18n();
  const config = useStravaConfig();
  const strava = device?.strava;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const time = (ms: number) => new Date(ms).toLocaleString(lang, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    syncStrava();
  }, []);

  const connect = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await connectStrava();
    } catch {
      setError(t('connections.stravaFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>{t('connections.title')}</h1>
      </header>
      <p className="muted">{t('connections.intro')}</p>

      <section className="card">
        <div className="section-head">
          <h2>Strava</h2>
          {strava && !strava.error && <span className="chip static">{t('health.on')}</span>}
        </div>
        <p className="muted small">{t('connections.stravaText')}</p>
        {strava ? (
          <>
            {strava.error ? (
              <p className="notice">{t('connections.stravaRevoked')}</p>
            ) : (
              <p className="small">
                {t('connections.stravaAs', { name: strava.athlete?.name || 'Strava' })}
                {strava.lastSync && (
                  <>
                    <br />
                    <span className="muted">
                      {t('connections.activities', { count: device?.stravaWorkouts?.length ?? 0 })} · {t('health.lastSync', { time: time(strava.lastSync) })}
                    </span>
                  </>
                )}
              </p>
            )}
            <div className="action-row">
              {strava.error ? (
                <button className="btn strava" onClick={connect} disabled={busy}>
                  Connect with Strava
                </button>
              ) : (
                <button className="btn" onClick={() => syncStrava(true)}>
                  {t('health.syncNow')}
                </button>
              )}
              <button className="btn danger" onClick={() => disconnectStrava()}>
                {t('health.disconnect')}
              </button>
            </div>
          </>
        ) : config && !config.configured ? (
          <p className="notice">{t('connections.stravaNotConfigured')}</p>
        ) : (
          <button className="btn strava" onClick={connect} disabled={busy || !config}>
            Connect with Strava
          </button>
        )}
        {error && <p className="notice">{error}</p>}
        <p className="powered-by">Powered by Strava</p>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>{isNative ? healthName() : 'Apple Health / Health Connect'}</h2>
          {device?.health?.enabled && <span className="chip static">{t('health.on')}</span>}
        </div>
        <p className="muted small">{t('connections.healthText')}</p>
        {isNative ? (
          <a className="btn" href="#/health">
            {device?.health?.enabled ? t('connections.manage') : t('health.connect', { name: healthName() })}
          </a>
        ) : (
          <p className="notice">{t('health.appOnly')}</p>
        )}
      </section>

      <section className="card">
        <h2>{t('connections.otherTitle')}</h2>
        <p className="muted small">{t('connections.otherText', { name: isNative ? healthName() : 'Apple Health / Health Connect' })}</p>
        <div className="chips wrap">
          {OTHER_APPS.map((app) => (
            <span key={app} className="chip static">
              {app}
            </span>
          ))}
        </div>
        <ol className="small steps-list">
          <li>{t('connections.step1')}</li>
          <li>{t('connections.step2', { name: isNative ? healthName() : 'Apple Health / Health Connect' })}</li>
          <li>{t('connections.step3')}</li>
        </ol>
        <p className="muted small">{t('connections.dedupe')}</p>
      </section>
    </>
  );
}
