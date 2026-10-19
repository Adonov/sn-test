import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Ring } from '../components/Ring';
import { useI18n } from '../i18n';
import { addDays, formatDay, fromISODate, toISODate } from '../lib/dates';
import {
  DEFAULT_GOALS,
  NUTRIENTS,
  entryNutrients,
  formatNutrient,
  sumNutrients,
  type FoodLogEntry,
  type NutrientInfo,
  type NutritionGoals,
} from '../lib/nutrition';
import { waterGoal } from '../lib/goals';
import { localize } from '../lib/localize';
import { loggingStreak } from '../lib/nutritionStats';
import { estimateRecipeNutrition } from '../lib/nutritionApi';
import { addDiaryEntries, addWater, removeDiaryEntry, toggleFavoriteFood, updateDiaryEntry, useAppState } from '../lib/store';
import { MEAL_SLOTS, type MealSlot, type Recipe } from '../lib/types';
import { DEFAULT_FAST_HOURS, fastStatus, formatDuration } from '../lib/fasting';
import { syncHealth } from '../lib/healthSync';
import { daySummary } from '../lib/today';
import { useNow } from '../lib/useNow';

const GLASS_ML = 250;

const MACROS: (keyof NutritionGoals)[] = ['protein', 'carbs', 'fat'];

function Meter({ value, goal }: { value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div className={`meter ${value > goal ? 'over' : ''}`} aria-hidden>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Nutrition({ date: dateParam }: { date?: string }) {
  const appState = useAppState();
  const { diary = [], nutritionGoals, profile, water = {}, waterGoal: savedWaterGoal, plan, recipes } = appState;
  const { t, lang, decimal } = useI18n();
  const goals = nutritionGoals ?? DEFAULT_GOALS;
  const today = toISODate(new Date());
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const [editing, setEditing] = useState<FoodLogEntry>();
  const [loggingPlanned, setLoggingPlanned] = useState<string>();
  const yesterday = toISODate(addDays(fromISODate(date), -1));
  const streak = loggingStreak(diary, today);
  const waterMl = water[date] ?? 0;
  const waterTarget = savedWaterGoal ?? waterGoal(profile?.weightKg);

  const day = useMemo(() => daySummary(appState, date), [appState, date]);
  const { entries, totals } = day;
  const kcal = totals.kcal ?? 0;
  const fmt = (value: number, info: NutrientInfo) => formatNutrient(value, info.unit, decimal);
  const info = (key: string) => NUTRIENTS.find((n) => n.key === key)!;

  const dayLabel =
    date === today ? t('detail.today') : date === toISODate(addDays(new Date(), -1)) ? t('nutrition.yesterday') : formatDay(fromISODate(date), lang);
  const shift = (days: number) => `#/nutrition/${toISODate(addDays(fromISODate(date), days))}`;

  const logPlanned = async (recipe: Recipe, slot: MealSlot) => {
    setLoggingPlanned(recipe.id);
    try {
      const perUnit = recipe.nutrition ?? (await estimateRecipeNutrition(recipe));
      addDiaryEntries([{ date, slot, name: recipe.title, amount: 1, unit: 'serving', perUnit, source: 'recipe', recipeId: recipe.id }]);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoggingPlanned(undefined);
    }
  };

  useEffect(() => {
    syncHealth();
  }, []);

  const detailRows = NUTRIENTS.filter((n) => n.group !== 'macro' && totals[n.key] !== undefined);

  return (
    <>
      <header className="page-header">
        <h1>{t('nutrition.title')}</h1>
        <div className="header-actions">
          <a className="btn" href="#/nutrition/progress">
            {t('progress.title')}
          </a>
          <a className="btn" href="#/nutrition/goals">
            {t('nutrition.goals')}
          </a>
          <a className="btn primary" href={`#/nutrition/add/${date}`}>
            <Icon name="plus" size={18} /> {t('nutrition.add')}
          </a>
        </div>
      </header>

      <div className="week-nav">
        <a className="icon-btn" href={shift(-1)} aria-label={t('nutrition.prevDay')}>
          <Icon name="back" size={20} />
        </a>
        <span className="day-label">{dayLabel}</span>
        <a className="icon-btn" href={shift(1)} aria-label={t('nutrition.nextDay')}>
          <span className="flip">
            <Icon name="back" size={20} />
          </span>
        </a>
      </div>

      {streak > 1 && date === today && <p className="center small streak">{t('streak.days', { count: streak })}</p>}

      {!profile && !nutritionGoals && (
        <section className="card notice-card">
          <h2>{t('goals.setup')}</h2>
          <p className="muted">{t('goals.setupText')}</p>
          <a className="btn primary" href="#/nutrition/goals">
            {t('goals.setup')}
          </a>
        </section>
      )}

      <section className="card hero">
        <div className="hero-row">
          <div className="hero-stat">
            <b>{Math.round(kcal)}</b>
            <small className="muted">{t('nutrition.eaten')}</small>
          </div>
          <Ring progress={day.budget > 0 ? kcal / day.budget : 0} tone={day.left < 0 ? 'over' : 'accent'}>
            <div className="ring-value">{Math.abs(Math.round(day.left))}</div>
            <div className="ring-label">{day.left < 0 ? t('widget.over') : t('widget.left')}</div>
          </Ring>
          <div className="hero-stat">
            {day.activity ? (
              <>
                <b>{Math.round(day.burned)}</b>
                <small className="muted">{t('nutrition.burned')}</small>
              </>
            ) : (
              <>
                <b>{goals.kcal}</b>
                <small className="muted">{t('nutrition.goal')}</small>
              </>
            )}
          </div>
        </div>
        <div className="macro-grid">
          {MACROS.map((key) => (
            <div key={key}>
              <div className="small">{t(`nutrient.${key}`)}</div>
              <div className="macro-value">
                {fmt(totals[key] ?? 0, info(key))} <span className="muted small">/ {goals[key]} g</span>
              </div>
              <Meter value={totals[key] ?? 0} goal={goals[key]} />
            </div>
          ))}
        </div>
        {day.activity && (
          <a className="activity-line" href="#/health">
            <span>{t('health.stepsCount', { count: (day.activity.steps ?? 0).toLocaleString(lang) })}</span>
            {(day.activity.exerciseMinutes ?? 0) > 0 && <span>{t('health.exerciseLine', { minutes: day.activity.exerciseMinutes ?? 0, kcal: day.activity.exerciseKcal ?? 0 })}</span>}
          </a>
        )}
      </section>

      {date === today && <FastingCard />}

      <section className="card water">
        <div className="section-head">
          <h2>{t('water.title')}</h2>
          <span className="muted small">
            {String(Math.round(waterMl / 100) / 10).replace('.', decimal)} / {String(Math.round(waterTarget / 100) / 10).replace('.', decimal)} l
          </span>
        </div>
        <div className="water-row">
          <button className="icon-btn" onClick={() => addWater(date, -GLASS_ML)} disabled={waterMl <= 0} aria-label={t('water.remove')}>
            −
          </button>
          <div className="glasses" aria-hidden>
            {Array.from({ length: Math.max(1, Math.ceil(waterTarget / GLASS_ML)) }, (_, i) => (
              <span key={i} className={`glass ${i < waterMl / GLASS_ML ? 'full' : ''}`} />
            ))}
          </div>
          <button className="icon-btn" onClick={() => addWater(date, GLASS_ML)} aria-label={t('water.add')}>
            <Icon name="plus" size={18} />
          </button>
        </div>
      </section>

      {entries.length === 0 && <p className="muted center">{t('nutrition.empty')}</p>}

      {MEAL_SLOTS.map((slot) => {
        const slotEntries = entries.filter((e) => e.slot === slot);
        const slotKcal = sumNutrients(slotEntries.map(entryNutrients)).kcal ?? 0;
        // Recipes planned for this meal that haven't been logged yet.
        const planned = plan
          .filter((p) => p.date === date && p.slot === slot && !slotEntries.some((e) => e.recipeId === p.recipeId))
          .map((p) => recipes.find((r) => r.id === p.recipeId))
          .filter((r): r is Recipe => Boolean(r))
          .map((r) => localize(r, lang));
        const yesterdays = slotEntries.length ? [] : diary.filter((e) => e.date === yesterday && e.slot === slot);
        return (
          <section key={slot} className="card meal">
            <div className="section-head">
              <h2>{t(`slot.${slot}`)}</h2>
              <span className="muted small">
                {slotEntries.length > 0 && `${Math.round(slotKcal)} kcal`}
                <a className="link-btn" href={`#/nutrition/add/${date}/${slot}`} aria-label={`${t('nutrition.add')}: ${t(`slot.${slot}`)}`}>
                  <Icon name="plus" size={18} />
                </a>
              </span>
            </div>
            {slotEntries.length > 0 && (
              <ul className="food-list">
                {slotEntries.map((e) => (
                  <li key={e.id}>
                    <button className="food-row" onClick={() => setEditing(e)}>
                      <span>
                        {e.name}
                        <small className="muted block">
                          {formatAmount(e, t('add.serving'), decimal)}
                        </small>
                      </span>
                      <span className="muted small">{Math.round(entryNutrients(e).kcal ?? 0)} kcal</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {planned.map((r) => (
              <div key={r.id} className="planned-row">
                <span>
                  <small className="muted block">{t('diary.planned')}</small>
                  {r.title}
                </span>
                <button className="btn small" disabled={loggingPlanned === r.id} onClick={() => logPlanned(r, slot)}>
                  {loggingPlanned === r.id ? t('recipe.estimating') : t('diary.logPlanned')}
                </button>
              </div>
            ))}
            {yesterdays.length > 0 && (
              <button
                className="link-btn small"
                onClick={() =>
                  addDiaryEntries(yesterdays.map(({ id: _id, createdAt: _c, ...rest }) => ({ ...rest, date })))
                }
              >
                {t('diary.copyYesterday')}
              </button>
            )}
          </section>
        );
      })}

      {detailRows.length > 0 && (
        <details className="card">
          <summary>
            <h2 className="inline">{t('nutrition.details')}</h2>
          </summary>
          <p className="muted small">{t('nutrition.microNote')}</p>
          <ul className="nutrient-list">
            {detailRows.map((n) => (
              <li key={n.key}>
                <span>{t(`nutrient.${n.key}`)}</span>
                <span className="muted small">
                  {fmt(totals[n.key]!, n)}
                  {n.reference ? ` · ${Math.round((totals[n.key]! / n.reference) * 100)} %` : ''}
                </span>
                {n.reference && <Meter value={totals[n.key]!} goal={n.reference} />}
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing && <EntryEditor entry={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}

function FastingCard() {
  const { fasting } = useAppState();
  const { t } = useI18n();
  const now = useNow(30_000, Boolean(fasting?.start));
  const hours = fasting?.planHours ?? DEFAULT_FAST_HOURS;
  const status = fasting?.start ? fastStatus(fasting.start, hours, now) : undefined;
  return (
    <a className="card fasting-card" href="#/fasting">
      <Ring progress={status?.progress ?? 0} size={52} stroke={6} tone="blue" />
      <span className="grow">
        <b>{status ? t('fasting.title') : t('fasting.cardTitle')}</b>
        <small className="muted block">
          {status
            ? status.done
              ? t('fasting.goalReached')
              : t('fasting.remaining', { time: formatDuration(status.remainingMs, false) })
            : t('fasting.cardText', { plan: `${hours}:${24 - hours}` })}
        </small>
      </span>
      <span className="btn small">{status ? formatDuration(status.elapsedMs, false) : t('fasting.startShort')}</span>
    </a>
  );
}

export function formatAmount(e: Pick<FoodLogEntry, 'amount' | 'unit'>, servingLabel: string, decimal: string): string {
  const amount = String(Math.round(e.amount * 10) / 10).replace('.', decimal);
  return e.unit === 'serving' ? `${amount} × ${servingLabel}` : `${amount} ${e.unit}`;
}

function EntryEditor({ entry, onClose }: { entry: FoodLogEntry; onClose: () => void }) {
  const { t, decimal } = useI18n();
  const { favoriteFoods = [] } = useAppState();
  const isFavorite = favoriteFoods.some((f) => f.name === entry.name && f.unit === entry.unit);
  const [amount, setAmount] = useState(String(entry.amount).replace('.', decimal));
  const [slot, setSlot] = useState<MealSlot>(entry.slot);
  const parsed = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed > 0;
  const preview = entryNutrients({ ...entry, amount: valid ? parsed : 0 });

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    updateDiaryEntry(entry.id, { amount: parsed, slot });
    onClose();
  };

  return (
    <Modal title={entry.name} onClose={onClose}>
      <form onSubmit={save}>
        <label className="field">
          <span>
            {t('add.amount')} ({entry.unit === 'serving' ? t('add.serving') : entry.unit})
          </span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </label>
        <p className="muted small">
          {Math.round(preview.kcal ?? 0)} kcal · {MACROS.map((k) => `${t(`nutrient.${k}`)} ${Math.round(preview[k] ?? 0)} g`).join(' · ')}
        </p>
        <div className="chips">
          {MEAL_SLOTS.map((s) => (
            <button type="button" key={s} className={`chip ${slot === s ? 'active' : ''}`} onClick={() => setSlot(s)}>
              {t(`slot.${s}`)}
            </button>
          ))}
        </div>
        <div className="action-row">
          <button className="btn primary" disabled={!valid}>
            {t('common.save')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => toggleFavoriteFood({ name: entry.name, amount: entry.amount, unit: entry.unit, perUnit: entry.perUnit })}
          >
            {isFavorite ? t('add.removeFavorite') : t('add.addFavorite')}
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              removeDiaryEntry(entry.id);
              onClose();
            }}
          >
            {t('common.remove')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
