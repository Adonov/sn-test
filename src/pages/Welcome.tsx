import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Wordmark } from '../components/Wordmark';
import { LANGUAGES, useI18n, type Language } from '../i18n';
import { cloudConfigured } from '../lib/cloud';
import { toISODate } from '../lib/dates';
import { goalsFromProfile, waterGoal, weeksToTarget, type Activity, type GoalType, type Profile, type Sex } from '../lib/goals';
import { requestHealthAccess } from '../lib/health';
import { syncHealth } from '../lib/healthSync';
import { refreshReminders, requestNotifications } from '../lib/notify';
import { isNative } from '../lib/platform';
import { DEFAULT_REMINDERS } from '../lib/reminders';
import { navigate } from '../lib/router';
import {
  finishOnboarding,
  logWeight,
  setHealthSettings,
  setLanguage,
  setNutritionGoals,
  setReminders,
} from '../lib/store';
import { healthName } from './Health';
import { Switch } from './Reminders';

type Step = 'welcome' | 'goal' | 'body' | 'activity' | 'pace' | 'plan' | 'habits';

const ACTIVITIES: Activity[] = ['sedentary', 'light', 'moderate', 'active', 'very'];
const GOALS: GoalType[] = ['lose', 'maintain', 'gain'];
const PACES = [0.25, 0.5, 0.75, 1];

const num = (v: string) => Number(v.replace(',', '.'));

/** First launch: a few questions, one per screen, that end with personal goals. */
export function Welcome() {
  const { t, lang, decimal } = useI18n();
  const [step, setStep] = useState<Step>('welcome');
  const [goal, setGoal] = useState<GoalType>('lose');
  const [sex, setSex] = useState<Sex>('female');
  const [birthYear, setBirthYear] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<Activity>('light');
  const [pace, setPace] = useState(0.5);
  const [target, setTarget] = useState('');
  const [reminders, setRemindersOn] = useState(true);
  const [health, setHealth] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const year = new Date().getFullYear();
  const bodyValid =
    num(birthYear) > 1900 && num(birthYear) <= year - 13 && num(height) >= 120 && num(height) <= 240 && num(weight) >= 30 && num(weight) <= 300;
  const profile: Profile | undefined = bodyValid
    ? {
        sex,
        birthYear: num(birthYear),
        heightCm: num(height),
        weightKg: num(weight),
        activity,
        goal,
        pace,
        targetWeightKg: num(target) > 0 ? num(target) : undefined,
      }
    : undefined;
  const goals = profile && goalsFromProfile(profile);
  const water = profile ? waterGoal(profile.weightKg) : 0;
  const eta = profile && weeksToTarget(profile);

  const steps: Step[] = ['welcome', 'goal', 'body', 'activity', ...(goal === 'maintain' ? [] : (['pace'] as Step[])), 'plan', ...(isNative ? (['habits'] as Step[]) : [])];
  const index = steps.indexOf(step);
  const next = () => setStep(steps[Math.min(index + 1, steps.length - 1)]);
  const back = () => setStep(steps[Math.max(index - 1, 0)]);
  const fmt = (n: number) => String(n).replace('.', decimal);

  const skip = () => {
    finishOnboarding();
    navigate('/');
  };

  const finish = async () => {
    if (!profile || !goals) return;
    setFinishing(true);
    setNutritionGoals(goals, profile, water);
    logWeight(toISODate(new Date()), profile.weightKg);
    if (isNative && reminders) {
      setReminders({
        ...DEFAULT_REMINDERS,
        breakfast: { ...DEFAULT_REMINDERS.breakfast, on: true },
        lunch: { ...DEFAULT_REMINDERS.lunch, on: true },
        dinner: { ...DEFAULT_REMINDERS.dinner, on: true },
        water: { ...DEFAULT_REMINDERS.water, on: true },
        weigh: { ...DEFAULT_REMINDERS.weigh, on: true },
      });
      await requestNotifications();
      refreshReminders();
    }
    if (isNative && health) {
      try {
        if (await requestHealthAccess()) {
          setHealthSettings({ enabled: true });
          syncHealth();
        }
      } catch (err) {
        console.warn(err);
      }
    }
    finishOnboarding();
    navigate('/nutrition');
  };

  const canContinue = step !== 'body' || bodyValid;

  return (
    <div className="onboarding">
      {step !== 'welcome' && (
        <div className="onboarding-top">
          <button className="icon-btn" onClick={back} aria-label={t('detail.back')}>
            <Icon name="back" size={20} />
          </button>
          <div className="progress-dots" aria-label={t('welcome.stepOf', { step: index, total: steps.length - 1 })}>
            {steps.slice(1).map((s, i) => (
              <span key={s} className={i < index ? 'done' : ''} />
            ))}
          </div>
          <button className="link-btn small" onClick={skip}>
            {t('welcome.skip')}
          </button>
        </div>
      )}

      <div className="onboarding-body" key={step}>
        {step === 'welcome' && (
          <div className="welcome-hero">
            <div className="welcome-logo" aria-hidden>
              <img src="/icon.svg" alt="" width={88} height={88} />
            </div>
            <div className="welcome-name">
              <Wordmark />
            </div>
            <h1>{t('welcome.title')}</h1>
            <p className="muted">{t('welcome.subtitle')}</p>
            <ul className="welcome-points">
              <li>
                <Icon name="book" /> {t('welcome.point1')}
              </li>
              <li>
                <Icon name="camera" /> {t('welcome.point2')}
              </li>
              <li>
                <Icon name="calendar" /> {t('welcome.point3')}
              </li>
            </ul>
            <div className="language-grid compact" role="radiogroup" aria-label={t('settings.language')}>
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
          </div>
        )}

        {step === 'goal' && (
          <>
            <h1>{t('welcome.goalQuestion')}</h1>
            <div className="option-list">
              {GOALS.map((g) => (
                <button key={g} className={`option ${goal === g ? 'active' : ''}`} onClick={() => setGoal(g)} aria-pressed={goal === g}>
                  <b>{t(`goal.${g}`)}</b>
                  <small>{t(`welcome.goal.${g}`)}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'body' && (
          <>
            <h1>{t('welcome.bodyQuestion')}</h1>
            <p className="muted">{t('welcome.bodyWhy')}</p>
            <div className="chips">
              {(['female', 'male'] as Sex[]).map((s) => (
                <button key={s} className={`chip ${sex === s ? 'active' : ''}`} onClick={() => setSex(s)}>
                  {t(`goals.${s}`)}
                </button>
              ))}
            </div>
            <label className="field">
              <span>{t('goals.birthYear')}</span>
              <input inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="1990" />
            </label>
            <div className="grid-2">
              <label className="field">
                <span>{t('goals.height')}</span>
                <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" />
              </label>
              <label className="field">
                <span>{t('goals.weight')}</span>
                <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70" />
              </label>
            </div>
          </>
        )}

        {step === 'activity' && (
          <>
            <h1>{t('welcome.activityQuestion')}</h1>
            <div className="option-list">
              {ACTIVITIES.map((a) => (
                <button key={a} className={`option ${activity === a ? 'active' : ''}`} onClick={() => setActivity(a)} aria-pressed={activity === a}>
                  <b>{t(`activity.${a}`)}</b>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'pace' && (
          <>
            <h1>{t(goal === 'gain' ? 'welcome.paceGain' : 'welcome.paceLose')}</h1>
            <div className="option-list">
              {PACES.map((p) => (
                <button key={p} className={`option ${pace === p ? 'active' : ''}`} onClick={() => setPace(p)} aria-pressed={pace === p}>
                  <b>{t('goals.paceValue', { kg: fmt(p) })}</b>
                  <small>{t(p <= 0.25 ? 'welcome.pace.gentle' : p <= 0.5 ? 'welcome.pace.steady' : 'welcome.pace.fast')}</small>
                </button>
              ))}
            </div>
            <label className="field">
              <span>{t('goals.target')}</span>
              <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
            </label>
          </>
        )}

        {step === 'plan' && goals && (
          <div className="plan-result">
            <h1>{t('welcome.planTitle')}</h1>
            <div className="plan-kcal">
              <span className="kcal-value">{goals.kcal}</span>
              <span className="muted">{t('welcome.kcalPerDay')}</span>
            </div>
            <div className="macro-grid">
              {(['protein', 'carbs', 'fat'] as const).map((k) => (
                <div key={k}>
                  <div className="small muted">{t(`nutrient.${k}`)}</div>
                  <div className="macro-value">{goals[k]} g</div>
                </div>
              ))}
              <div>
                <div className="small muted">{t('water.title')}</div>
                <div className="macro-value">{fmt(Math.round(water / 100) / 10)} l</div>
              </div>
            </div>
            {eta && <p className="notice success">{t('goals.eta', { weeks: eta })}</p>}
            <p className="muted small">{t('welcome.planNote')}</p>
          </div>
        )}

        {step === 'habits' && (
          <>
            <h1>{t('welcome.habitsTitle')}</h1>
            <p className="muted">{t('welcome.habitsText')}</p>
            <section className="card">
              <Switch label={t('welcome.reminders')} hint={t('welcome.remindersHint')} checked={reminders} onChange={setRemindersOn} />
              <Switch label={t('health.connect', { name: healthName() })} hint={t('welcome.healthHint')} checked={health} onChange={setHealth} />
            </section>
          </>
        )}
      </div>

      <div className="onboarding-actions">
        {step === 'welcome' ? (
          <>
            <button className="btn primary wide" onClick={next}>
              {t('welcome.start')}
            </button>
            <div className="onboarding-links">
              {cloudConfigured && (
                <a className="link-btn" href="#/account">
                  {t('welcome.haveAccount')}
                </a>
              )}
              <button className="link-btn" onClick={skip}>
                {t('welcome.justRecipes')}
              </button>
            </div>
          </>
        ) : index === steps.length - 1 ? (
          <button className="btn primary wide" onClick={finish} disabled={finishing || !goals}>
            {t('welcome.finish')}
          </button>
        ) : (
          <button className="btn primary wide" onClick={next} disabled={!canContinue}>
            {t('welcome.continue')}
          </button>
        )}
      </div>
    </div>
  );
}
