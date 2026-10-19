import { useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import { deleteAccount, signIn, signOut, signUp, useAccount, type AuthErrorCode } from '../lib/cloud';

type Mode = 'signIn' | 'signUp';

export function Account() {
  const { t, lang } = useI18n();
  const { user, syncing, syncError, lastSyncedAt } = useAccount();
  const [mode, setMode] = useState<Mode>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorCode>();
  const [notice, setNotice] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const result = mode === 'signUp' ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
    setBusy(false);
    if (!result.ok) return setError(result.code);
    setPassword('');
    if (result.needsConfirmation) {
      setNotice(t('account.checkEmail'));
      setMode('signIn');
    }
  };

  const remove = async () => {
    if (!confirm(t('account.confirmDelete'))) return;
    setBusy(true);
    const ok = await deleteAccount();
    setBusy(false);
    setNotice(ok ? t('account.deleted') : t('account.deleteFailed'));
  };

  if (user) {
    const status = syncing
      ? t('account.syncing')
      : syncError
        ? t('account.syncError')
        : lastSyncedAt
          ? t('account.synced', { time: new Date(lastSyncedAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) })
          : '';
    return (
      <>
        <header className="page-header">
          <h1>{t('account.title')}</h1>
        </header>
        <section className="card">
          <p>{t('account.signedInAs', { email: user.email ?? '' })}</p>
          {status && (
            <p className="muted small" role="status">
              {status}
            </p>
          )}
          <div className="action-row">
            <button className="btn" onClick={() => signOut()} disabled={busy}>
              {t('account.signOut')}
            </button>
          </div>
          <p className="muted small">{t('account.signOutNote')}</p>
        </section>
        <button className="link-btn danger center-block" onClick={remove} disabled={busy}>
          {t('account.delete')}
        </button>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <h1>{t('account.title')}</h1>
      </header>
      <p className="muted">{t('account.intro')}</p>
      {notice && <p className="notice">{notice}</p>}
      <form className="card" onSubmit={submit}>
        <label className="field">
          <span>{t('account.email')}</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('account.password')}</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {t(`account.err.${error}`)}
          </p>
        )}
        <div className="action-row">
          <button className="btn primary" disabled={busy}>
            {mode === 'signUp' ? t('account.signUp') : t('account.signIn')}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode(mode === 'signUp' ? 'signIn' : 'signUp');
              setError(undefined);
            }}
          >
            {mode === 'signUp' ? t('account.toSignIn') : t('account.toSignUp')}
          </button>
        </div>
      </form>
    </>
  );
}
