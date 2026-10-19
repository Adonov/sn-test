import { useMemo, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import { toISODate } from '../lib/dates';
import { goalsFromProfile, waterGoal, weeksToTarget, type Activity, type GoalType, type Profile, type Sex } from '../lib/goals';
import { DEFAULT_GOALS, type NutritionGoals } from '../lib/nutrition';
import { navigate } from '../lib/router';
import { logWeight, setNutritionGoals, useAppState } from '../lib/store';

const ACTIVITIES: Activity[] = ['sedentary', 'light', 'moderate', 'active', 'very'];
const GOALS: GoalType[] = ['lose', 'maintain', 'gain'];
const PACES = [0.25, 0.5, 0.75, 1];
const MACROS = ['kcal', 'protein', 'carbs', 'fat'] as const;

const num = (v: string) => Number(v.replace(',', '.'));

export function Goals() {
  const { profile, nutritionGoals, waterGoal: savedWater, weights = [] } = useAppState();
  const { t, decimal } = useI18n();
  const latestWeight = weights[weights.length - 1]?.kg;
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'female');
  const [birthYear, setBirthYear] = useState(String(profile?.birthYear ?? ''));
  const [height, setHeight] = useState(String(profile?.heightCm ?? ''));
  const [weight, setWeight] = useState(String(latestWeight ?? profile?.weightKg ?? '').replace('.', decimal));
  const [activity, setActivity] = useState<Activity>(profile?.activity ?? 'light');
  const [goal, setGoal] = useState<GoalType>(profile?.goal ?? 'maintain');
  const [pace, setPace] = useState(profile?.pace ?? 0.5);
  const [target, setTarget] = useState(profile?.targetWeightKg ? String(profile.targetWeightKg).replace('.', decimal) : '');
  // Manual overrides; empty means "use the calculated value".
  const [manual, setManual] = useState<Partial<Record<(typeof MACROS)[number] | 'water', string>>>({});

  const year = new Date().getFullYear();
  const draft: Profile | undefined = useMemo(() => {
    const by = num(birthYear);
    const h = num(height);
    const w = num(weight);
    if (!(by > 1900 && by <= year - 13 && h >= 120 && h <= 240 && w >= 30 && w <= 300)) return undefined;
    const tw = num(target);
    return { sex, birthYear: by, heightCm: h, weightKg: w, activity, goal, pace, targetWeightKg: tw > 0 ? tw : undefined };
  }, [sex, birthYear, height, weight, activity, goal, pace, target, year]);

  const calculated: NutritionGoals = draft ? goalsFromProfile(draft) : nutritionGoals ?? DEFAULT_GOALS;
  const final: NutritionGoals = {
    kcal: num(manual.kcal ?? '') || calculated.kcal,
    protein: num(manual.protein ?? '') || calculated.protein,
    carbs: num(manual.carbs ?? '') || calculated.carbs,
    fat: num(manual.fat ?? '') || calculated.fat,
  };
  const water = num(manual.water ?? '') || (draft ? waterGoal(draft.weightKg) : savedWater ?? waterGoal());
  const eta = draft && weeksToTarget(draft);

  const save = (e: FormEvent) => {
    e.preventDefault();
    setNutritionGoals(
      { kcal: Math.round(final.kcal), protein: Math.round(final.protein), carbs: Math.round(final.carbs), fat: Math.round(final.fat) },
      draft,
      Math.round(water),
    );
    // The first time, the profile weight also starts the weight chart.
    if (draft && latestWeight !== draft.weightKg) logWeight(toISODate(new Date()), draft.weightKg);
    navigate('/nutrition');
  };

  return (
    <form onSubmit={save}>
      <header className="page-header">
        <h1>{t('goals.title')}</h1>
      </header>

      <section className="card">
        <h2>{t('goals.calcTitle')}</h2>
        <div className="field">
          <span>{t('goals.sex')}</span>
          <div className="chips">
            {(['female', 'male'] as Sex[]).map((s) => (
              <button type="button" key={s} className={`chip ${sex === s ? 'active' : ''}`} onClick={() => setSex(s)}>
                {t(`goals.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid-3">
          <label className="field">
            <span>{t('goals.birthYear')}</span>
            <input inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="1990" />
          </label>
          <label className="field">
            <span>{t('goals.height')}</span>
            <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" />
          </label>
          <label className="field">
            <span>{t('goals.weight')}</span>
            <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70" />
          </label>
        </div>
        <label className="field">
          <span>{t('goals.activity')}</span>
          <select value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
            {ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {t(`activity.${a}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>{t('goals.goal')}</span>
          <div className="chips">
            {GOALS.map((g) => (
              <button type="button" key={g} className={`chip ${goal === g ? 'active' : ''}`} onClick={() => setGoal(g)}>
                {t(`goal.${g}`)}
              </button>
            ))}
          </div>
        </div>
        {goal !== 'maintain' && (
          <>
            <div className="field">
              <span>{t('goals.pace')}</span>
              <div className="chips">
                {PACES.map((p) => (
                  <button type="button" key={p} className={`chip ${pace === p ? 'active' : ''}`} onClick={() => setPace(p)}>
                    {t('goals.paceValue', { kg: String(p).replace('.', decimal) })}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>{t('goals.target')}</span>
              <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
            </label>
          </>
        )}
      </section>

      <section className="card summary">
        <h2>{t('goals.result')}</h2>
        <div className="kcal-value">{Math.round(final.kcal)}</div>
        <div className="muted small">kcal</div>
        <div className="macro-grid">
          {(['protein', 'carbs', 'fat'] as const).map((k) => (
            <div key={k}>
              <div className="small muted">{t(`nutrient.${k}`)}</div>
              <div className="macro-value">{Math.round(final[k])} g</div>
            </div>
          ))}
          <div>
            <div className="small muted">{t('water.title')}</div>
            <div className="macro-value">{String(Math.round(water / 100) / 10).replace('.', decimal)} l</div>
          </div>
        </div>
        {eta && <p className="muted small">{t('goals.eta', { weeks: eta })}</p>}
        <details>
          <summary className="link-btn">{t('goals.manual')}</summary>
          <div className="grid-2">
            {[...MACROS, 'water' as const].map((k) => (
              <label key={k} className="field">
                <span>{k === 'water' ? t('goals.water') : `${t(`nutrient.${k}`)} (${k === 'kcal' ? 'kcal' : 'g'})`}</span>
                <input
                  inputMode="numeric"
                  value={manual[k] ?? ''}
                  placeholder={String(Math.round(k === 'water' ? water : calculated[k]))}
                  onChange={(e) => setManual((m) => ({ ...m, [k]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </details>
      </section>

      <p className="muted small">{t('goals.disclaimer')}</p>
      <div className="action-row sticky-actions">
        <button type="button" className="btn" onClick={() => history.back()}>
          {t('editor.cancel')}
        </button>
        <button className="btn primary">{t('nutrition.saveGoals')}</button>
      </div>
    </form>
  );
}
