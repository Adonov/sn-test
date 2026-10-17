import { useState } from 'react';
import { Modal } from '../components/Modal';
import { RecipeImage } from '../components/RecipeImage';
import { addDays, formatDay, fromISODate, startOfWeek, toISODate } from '../lib/dates';
import { navigate } from '../lib/router';
import { addPlanEntry, addPlanToGrocery, removePlanEntry, updatePlanServings, useAppState } from '../lib/store';
import { MEAL_SLOTS, type MealSlot } from '../lib/types';

export function Planner() {
  const { plan, recipes } = useAppState();
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
        <h1>Načrt obrokov</h1>
        <button className="btn primary" onClick={toGrocery} disabled={!weekEntries.length}>
          🛒 Nakupovalni seznam za teden
        </button>
      </header>

      <div className="week-nav">
        <button className="icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Prejšnji teden">
          ←
        </button>
        <button className="link-btn" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          {fromISODate(from).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' })} –{' '}
          {fromISODate(to).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' })}
        </button>
        <button className="icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Naslednji teden">
          →
        </button>
      </div>

      <div className="week">
        {days.map((day) => {
          const date = toISODate(day);
          const entries = weekEntries.filter((p) => p.date === date);
          return (
            <section key={date} className={`day card ${date === today ? 'today' : ''}`}>
              <h2>{formatDay(day)}</h2>
              {MEAL_SLOTS.map((slot) => {
                const slotEntries = entries.filter((e) => e.slot === slot.id);
                return (
                  <div key={slot.id} className="slot">
                    <div className="slot-head">
                      <span className="muted small">{slot.label}</span>
                      <button className="link-btn small" onClick={() => setPicking({ date, slot: slot.id })} aria-label={`Dodaj ${slot.label.toLowerCase()}`}>
                        ＋
                      </button>
                    </div>
                    {slotEntries.map((entry) => {
                      const recipe = recipes.find((r) => r.id === entry.recipeId);
                      if (!recipe) return null;
                      return (
                        <div key={entry.id} className="plan-entry">
                          <a href={`#/recipe/${recipe.id}`} className="plan-entry-link">
                            <RecipeImage className="thumb" src={recipe.image} title={recipe.title} />
                            <span>{recipe.title}</span>
                          </a>
                          <select
                            value={entry.servings}
                            onChange={(e) => updatePlanServings(entry.id, Number(e.target.value))}
                            aria-label="Porcije"
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n} 🍽
                              </option>
                            ))}
                          </select>
                          <button className="icon-btn small" onClick={() => removePlanEntry(entry.id)} aria-label="Odstrani">
                            ✕
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
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = recipes.filter((r) => !q || r.title.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q)));
  const label = MEAL_SLOTS.find((s) => s.id === slot)!.label;

  return (
    <Modal title={`${label} · ${formatDay(fromISODate(date))}`} onClose={onClose}>
      <input className="search" type="search" autoFocus placeholder="Išči recept…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {recipes.length === 0 && <p className="muted">Najprej dodaj kakšen recept.</p>}
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
