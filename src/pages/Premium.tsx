import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Wordmark } from '../components/Wordmark';
import { useI18n } from '../i18n';
import { API_BASE } from '../lib/api';
import { buy, FREE_AI_PER_WEEK, loadPlans, premiumAvailable, restore, usePremium, type Plan } from '../lib/premium';

const PRIVACY_URL = `${API_BASE ?? ''}/privacy.html`;
// Apple's standard licence agreement covers the subscription terms.
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** What Premium unlocks and the plans to buy it. */
export function Premium() {
  const { t } = useI18n();
  const { premium, left } = usePremium();
  const [plans, setPlans] = useState<Plan[]>();
  const [chosen, setChosen] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!premiumAvailable || premium) return;
    loadPlans()
      .then((list) => {
        setPlans(list);
        setChosen((list.find((p) => p.period === 'annual') ?? list[0])?.id);
      })
      .catch((err) => {
        console.warn(err);
        setPlans([]);
      });
  }, [premium]);

  const plan = plans?.find((p) => p.id === chosen);

  const run = async (action: () => Promise<boolean>, failed: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      if (!(await action())) setMessage(failed);
    } catch (err) {
      console.warn(err);
      setMessage(t('premium.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <button className="icon-btn" onClick={() => history.back()} aria-label={t('detail.back')}>
          <Icon name="back" size={20} />
        </button>
      </header>

      <div className="premium-hero">
        <div className="welcome-name">
          <Wordmark /> <span className="premium-badge">Premium</span>
        </div>
        <h1>{premium ? t('premium.active') : t('premium.title')}</h1>
        {!premium && left !== Infinity && <p className="muted">{t('premium.left', { count: left })}</p>}
      </div>

      <section className="card">
        <ul className="welcome-points premium-points">
          <li>
            <Icon name="camera" /> {t('premium.point1')}
          </li>
          <li>
            <Icon name="sparkle" /> {t('premium.point2')}
          </li>
          <li>
            <Icon name="book" /> {t('premium.point3')}
          </li>
        </ul>
      </section>
      <p className="muted small">{t('premium.free', { count: FREE_AI_PER_WEEK })}</p>

      {!premium &&
        (!premiumAvailable ? (
          <p className="notice">{t('premium.appOnly')}</p>
        ) : !plans ? (
          <p className="muted">{t('premium.loading')}</p>
        ) : !plans.length ? (
          <p className="notice">{t('premium.noPlans')}</p>
        ) : (
          <>
            <div className="option-list" role="radiogroup">
              {plans.map((p) => (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={chosen === p.id}
                  className={`option ${chosen === p.id ? 'active' : ''}`}
                  onClick={() => setChosen(p.id)}
                >
                  <b>{p.period === 'other' ? p.pkg.product.title : t(`premium.${p.period}`)}</b>
                  <small>{p.period === 'other' ? p.price : t(`premium.${p.period}Price`, { price: p.price })}</small>
                </button>
              ))}
            </div>
            <button className="btn primary wide" disabled={busy || !plan} onClick={() => plan && run(() => buy(plan), t('premium.cancelled'))}>
              {t('premium.subscribe')}
            </button>
            <p className="muted small">{t('premium.renews')}</p>
          </>
        ))}

      {message && <p className="notice">{message}</p>}

      {premiumAvailable && !premium && (
        <p className="center">
          <button className="link-btn" disabled={busy} onClick={() => run(restore, t('premium.nothingToRestore'))}>
            {t('premium.restore')}
          </button>
        </p>
      )}
      <p className="center small">
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer noopener">
          {t('settings.privacy')}
        </a>
        {' · '}
        <a href={TERMS_URL} target="_blank" rel="noreferrer noopener">
          {t('premium.terms')}
        </a>
      </p>
    </>
  );
}
