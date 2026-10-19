import { useMemo, useState, type FormEvent } from 'react';
import { BarChart, LineChart } from '../components/Charts';
import { useI18n } from '../i18n';
import { fromISODate, toISODate } from '../lib/dates';
import { DEFAULT_GOALS } from '../lib/nutrition';
import { dailyTotals, loggingStreak } from '../lib/nutritionStats';
import { logWeight, useAppState } from '../lib/store';

const DAY_MS = 86_400_000;

export function Progress() {
  const { diary = [], nutritionGoals, weights = [], profile } = useAppState();
  const { t, lang, decimal } = useI18n();
  const goals = nutritionGoals ?? DEFAULT_GOALS;
  const today = toISODate(new Date());
  const [weight, setWeight] = useState('');

  const week = useMemo(() => dailyTotals(diary, today, 7), [diary, today]);
  const logged = week.filter((d) => d.logged);
  const average = logged.length ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length) : 0;
  const streak = loggingStreak(diary, today);
  const fmtKg = (kg: number) => String(Math.round(kg * 10) / 10).replace('.', decimal);
  const shortDate = (iso: string) => fromISODate(iso).toLocaleDateString(lang, { day: 'numeric', month: 'short' });

  const recentWeights = weights.slice(-60);
  const first = recentWeights[0];
  const last = recentWeights[recentWeights.length - 1];
  const change = first && last && first !== last ? last.kg - first.kg : undefined;

  const save = (e: FormEvent) => {
    e.preventDefault();
    const kg = Number(weight.replace(',', '.'));
    if (kg >= 30 && kg <= 300) {
      logWeight(today, kg);
      setWeight('');
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>{t('progress.title')}</h1>
        {streak > 0 && <span className="streak">{t('streak.days', { count: streak })}</span>}
      </header>

      <section className="card">
        <h2>{t('progress.week')}</h2>
        <p className="muted small">{average > 0 && t('progress.average', { value: average })}</p>
        <BarChart
          title={t('progress.week')}
          reference={goals.kcal}
          referenceLabel={`${t('progress.goalLabel')} ${goals.kcal}`}
          data={week.map((d) => ({
            label: fromISODate(d.date).toLocaleDateString(lang, { weekday: 'narrow' }),
            value: d.kcal,
            highlight: d.date === today,
            detail: `${Math.round(d.kcal)} kcal · ${t('nutrient.protein')} ${Math.round(d.protein)} g`,
          }))}
        />
      </section>

      <section className="card">
        <div className="section-head">
          <h2>{t('progress.weight')}</h2>
          {change !== undefined && (
            <span className="muted small">
              {t('progress.change', { value: `${change > 0 ? '+' : ''}${fmtKg(change)}`, date: shortDate(first.date) })}
            </span>
          )}
        </div>
        {recentWeights.length > 0 ? (
          <LineChart
            title={t('progress.weight')}
            target={profile?.targetWeightKg}
            targetLabel={profile?.targetWeightKg ? `${t('progress.goalLabel')} ${fmtKg(profile.targetWeightKg)} kg` : undefined}
            points={recentWeights.map((w) => ({
              x: (fromISODate(w.date).getTime() - fromISODate(recentWeights[0].date).getTime()) / DAY_MS,
              value: w.kg,
              label: shortDate(w.date),
              detail: `${fmtKg(w.kg)} kg`,
            }))}
          />
        ) : (
          <p className="muted">{t('progress.noWeight')}</p>
        )}
        <form className="add-item" onSubmit={save}>
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="kg" aria-label={t('goals.weight')} />
          <button className="btn primary">{t('progress.logWeight')}</button>
        </form>
      </section>
    </>
  );
}
