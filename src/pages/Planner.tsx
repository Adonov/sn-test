import { useState } from 'react';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { RecipeImage } from '../components/RecipeImage';
import { useI18n } from '../i18n';
import { addDays, formatDay, fromISODate, startOfWeek, toISODate } from '../lib/dates';
import { localize } from '../lib/localize';
import { navigate } from '../lib/router';
import { addPlanEntry, addPlanToGrocery, removePlanEntry, updatePlanServings, useAppState } from '../lib/store';
import { MEAL_SLOTS, type MealSlot } from '../lib/types';

export function Planner() {
  const { plan, recipes } = useAppState();
  const { t, lang } = useI18n();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [picking, setPicking] = useState<{ date: string; slot: MealSlot }>();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const from = toISODate(days[0]);
  const to = toISODate(days[6]);
  const today = toISODate(new Date());
  const weekEntries = plan.filter((p) => p.date >= from && p.date <= to);

  const toGrocery = () => {
    const count = addPlanToGrocery(from, to);
    if (count) navigate('/grocery');
  };

  return (
    <>
      <header className="page-header">
        <h1>{t('planner.title')}</h1>
        <button className="btn primary" onClick={toGrocery} disabled={!weekEntries.length}>
          {t('planner.toGrocery')}
        </button>
      </header>

      <div className="week-nav">
        <button className="icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label={t('planner.prevWeek')}>
          <Icon name="back" size={20} />
        </button>
        <button className="link-btn" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          {fromISODate(from).toLocaleDateString(lang, { day: 'numeric', month: 'long' })} –{' '}
          {fromISODate(to).toLocaleDateString(lang, { day: 'numeric', month: 'long' })}
        </button>
        <button className="icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label={t('planner.nextWeek')}>
          <span className="flip">
            <Icon name="back" size={20} />
          </span>
        </button>
      </div>

      <div className="week">
        {days.map((day) => {
          const date = toISODate(day);
          const entries = weekEntries.filter((p) => p.date === date);
          return (
            <section key={date} className={`day card ${date === today ? 'today' : ''}`}>
              <h2>{formatDay(day, lang)}</h2>
              {MEAL_SLOTS.map((slot) => {
                const slotEntries = entries.filter((e) => e.slot === slot);
                const label = t(`slot.${slot}`);
                return (
                  <div key={slot} className="slot">
                    <div className="slot-head">
                      <span className="muted small">{label}</span>
                      <button className="link-btn small" onClick={() => setPicking({ date, slot })} aria-label={t('planner.add', { slot: label.toLowerCase() })}>
                        <Icon name="plus" size={18} />
                      </button>
                    </div>
                    {slotEntries.map((entry) => {
                      const found = recipes.find((r) => r.id === entry.recipeId);
                      if (!found) return null;
                      const recipe = localize(found, lang);
                      return (
                        <div key={entry.id} className="plan-entry">
                          <a href={`#/recipe/${recipe.id}`} className="plan-entry-link">
                            <RecipeImage className="thumb" src={recipe.image} title={recipe.title} />
                            <span>{recipe.title}</span>
                          </a>
                          <select
                            value={entry.servings}
                            onChange={(e) => updatePlanServings(entry.id, Number(e.target.value))}
                            aria-label={t('planner.servings')}
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                          <button className="icon-btn small" onClick={() => removePlanEntry(entry.id)} aria-label={t('common.remove')}>
                            <Icon name="close" size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      {picking && <RecipePicker date={picking.date} slot={picking.slot} onClose={() => setPicking(undefined)} />}
    </>
  );
}

function RecipePicker({ date, slot, onClose }: { date: string; slot: MealSlot; onClose: () => void }) {
  const { recipes } = useAppState();
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = recipes.map((r) => localize(r, lang)).filter((r) => !q || r.title.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q)));
  return (
    <Modal title={`${t(`slot.${slot}`)} · ${formatDay(fromISODate(date), lang)}`} onClose={onClose}>
      <input className="search" type="search" autoFocus placeholder={t('planner.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      {recipes.length === 0 && <p className="muted">{t('planner.noRecipes')}</p>}
      <ul className="picker-list">
        {matches.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => {
                addPlanEntry(date, slot, r.id, r.servings);
                onClose();
              }}
            >
              <RecipeImage className="thumb" src={r.image} title={r.title} />
              <span>{r.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
