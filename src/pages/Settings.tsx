import { useRef, useState } from 'react';
import { LANGUAGES, useI18n, type Language } from '../i18n';
import { cloudConfigured, useAccount } from '../lib/cloud';
import { exportBackup, importBackup, resetAll, setLanguage, useAppState } from '../lib/store';

export function Settings() {
  const { recipes, plan } = useAppState();
  const { t, lang } = useI18n();
  const { user } = useAccount();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>();

  const download = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `forkful-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (file?: File) => {
    if (!file) return;
    try {
      importBackup(await file.text());
      setMessage(t('settings.restored'));
    } catch {
      setMessage(t('settings.invalidBackup'));
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>{t('settings.title')}</h1>
      </header>

      {cloudConfigured && (
        <section className="card">
          <h2>{t('account.title')}</h2>
          {user && <p className="muted">{t('account.signedInAs', { email: user.email ?? '' })}</p>}
          <a className={`btn ${user ? '' : 'primary'}`} href="#/account">
            {user ? t('account.title') : t('account.cta')}
          </a>
        </section>
      )}

      <section className="card">
        <h2>{t('settings.language')}</h2>
        <div className="language-grid" role="radiogroup" aria-label={t('settings.language')}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="radio"
              aria-checked={lang === l.code}
              className={`chip ${lang === l.code ? 'active' : ''}`}
              onClick={() => setLanguage(l.code as Language)}
              lang={l.code}
            >
              {l.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>{t('settings.data')}</h2>
        <p className="muted">
          {t('settings.counts', { recipes: recipes.length, meals: plan.length })}
          {!user && (
            <>
              <br />
              {t('settings.dataStored')}
            </>
          )}
        </p>
        <div className="action-row">
          <button className="btn" onClick={download}>
            {t('settings.export')}
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            {t('settings.restore')}
          </button>
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
        </div>
        {message && <p className="notice">{message}</p>}
      </section>

      <section className="card">
        <h2>{t('settings.reset')}</h2>
        <p className="muted">{t('settings.resetText')}</p>
        <button className="btn danger" onClick={() => confirm(t('settings.confirmReset')) && resetAll()}>
          {t('settings.resetButton')}
        </button>
      </section>
    </>
  );
}
