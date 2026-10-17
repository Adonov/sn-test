import { useState } from 'react';
import { Modal } from '../components/Modal';
import { RecipeImage } from '../components/RecipeImage';
import { addDays, formatDay, formatMinutes, startOfWeek, toISODate } from '../lib/dates';
import { isHeading, scaleIngredient } from '../lib/ingredients';
import { navigate } from '../lib/router';
import { addPlanEntry, addRecipeToGrocery, deleteRecipe, toggleFavorite } from '../lib/store';
import { MEAL_SLOTS, type MealSlot, type Recipe } from '../lib/types';

export function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const [servings, setServings] = useState(recipe.servings || 1);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [planOpen, setPlanOpen] = useState(false);
  const [toast, setToast] = useState<string>();
  const factor = servings / (recipe.servings || 1);

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(undefined), 2500);
  };

  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const addToGrocery = () => {
    // With some ingredients ticked ("I have these"), only the rest go on the list.
    const lines = recipe.ingredients.filter((_, i) => !checked.has(i));
    addRecipeToGrocery(recipe, servings, lines);
    flash(`Dodano na nakupovalni seznam (${lines.filter((l) => !isHeading(l)).length})`);
  };

  const remove = () => {
    if (confirm(`Izbrišem recept »${recipe.title}«?`)) {
      deleteRecipe(recipe.id);
      navigate('/');
    }
  };

  const source = httpUrl(recipe.sourceUrl);
  const time = [
    recipe.prepMinutes && `Priprava ${formatMinutes(recipe.prepMinutes)}`,
    recipe.cookMinutes && `Kuhanje ${formatMinutes(recipe.cookMinutes)}`,
  ].filter(Boolean);

  return (
    <article className="recipe-detail">
      <div className="detail-hero">
        <RecipeImage className="hero-image" src={recipe.image} title={recipe.title} />
        <div className="hero-actions">
          <a className="icon-btn" href="#/" aria-label="Nazaj">
            ←
          </a>
          <span className="spacer" />
          <button className="icon-btn" onClick={() => toggleFavorite(recipe.id)} aria-label="Priljubljeno" aria-pressed={recipe.favorite}>
            {recipe.favorite ? '♥' : '♡'}
          </button>
          <a className="icon-btn" href={`#/recipe/${recipe.id}/edit`} aria-label="Uredi">
            ✎
          </a>
          <button className="icon-btn" onClick={remove} aria-label="Izbriši">
            🗑
          </button>
        </div>
      </div>

      <h1>{recipe.title}</h1>
      {recipe.description && <p className="lead">{recipe.description}</p>}
      <p className="muted small">
        {time.join(' · ')}
        {source && (
          <>
            {time.length > 0 && ' · '}
            <a href={source.href} target="_blank" rel="noreferrer noopener">
              Vir: {source.hostname.replace(/^www\./, '')}
            </a>
          </>
        )}
      </p>
      {recipe.tags.length > 0 && (
        <div className="chips">
          {recipe.tags.map((t) => (
            <span key={t} className="chip static">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="action-row">
        <a className="btn primary" href={`#/recipe/${recipe.id}/cook`}>
          👩‍🍳 Začni kuhati
        </a>
        <button className="btn" onClick={() => setPlanOpen(true)}>
          📅 V načrt
        </button>
        <button className="btn" onClick={addToGrocery}>
          🛒 Na seznam
        </button>
      </div>

      <section className="card">
        <div className="section-head">
          <h2>Sestavine</h2>
          <div className="stepper" aria-label="Število porcij">
            <button onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Manj porcij">
              −
            </button>
            <span>
              {servings} {servings === 1 ? 'porcija' : servings === 2 ? 'porciji' : servings < 5 ? 'porcije' : 'porcij'}
            </span>
            <button onClick={() => setServings((s) => s + 1)} aria-label="Več porcij">
              ＋
            </button>
          </div>
        </div>
        {checked.size > 0 && <p className="muted small">Označene sestavine (ki jih že imaš) ne bodo dodane na seznam.</p>}
        <ul className="ingredients">
          {recipe.ingredients.map((line, i) =>
            isHeading(line) ? (
              <li key={i} className="ingredient-heading">
                {line}
              </li>
            ) : (
              <li key={i}>
                <label className={checked.has(i) ? 'is-checked' : ''}>
                  <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} />
                  <span>{scaleIngredient(line, factor)}</span>
                </label>
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="card">
        <h2>Postopek</h2>
        <ol className="steps">
          {recipe.steps.map((step, i) =>
            isHeading(step) ? (
              <li key={i} className="step-heading">
                {step}
              </li>
            ) : (
              <li key={i}>{step}</li>
            ),
          )}
        </ol>
      </section>

      {recipe.notes && (
        <section className="card">
          <h2>Opombe</h2>
          <p className="pre-line">{recipe.notes}</p>
        </section>
      )}

      {planOpen && (
        <AddToPlanModal
          recipe={recipe}
          servings={servings}
          onClose={() => setPlanOpen(false)}
          onAdded={(label) => {
            setPlanOpen(false);
            flash(`Dodano v načrt: ${label}`);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </article>
  );
}

function AddToPlanModal({
  recipe,
  servings,
  onClose,
  onAdded,
}: {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
  onAdded: (label: string) => void;
}) {
  const today = new Date();
  const [slot, setSlot] = useState<MealSlot>('dinner');
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const thisWeekEnd = addDays(startOfWeek(today), 6);

  return (
    <Modal title="Dodaj v načrt obrokov" onClose={onClose}>
      <div className="chips">
        {MEAL_SLOTS.map((s) => (
          <button key={s.id} className={`chip ${slot === s.id ? 'active' : ''}`} onClick={() => setSlot(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="day-picker">
        {days.map((d, i) => (
          <button
            key={i}
            className={`day-option ${d > thisWeekEnd ? 'next-week' : ''}`}
            onClick={() => {
              addPlanEntry(toISODate(d), slot, recipe.id, servings);
              onAdded(`${formatDay(d)}, ${MEAL_SLOTS.find((s) => s.id === slot)!.label.toLowerCase()}`);
            }}
          >
            {i === 0 ? 'Danes' : i === 1 ? 'Jutri' : formatDay(d)}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Only http(s) links are rendered, so a pasted "javascript:" URL can't run. */
function httpUrl(url?: string): URL | undefined {
  try {
    const parsed = new URL(url ?? '');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : undefined;
  } catch {
    return undefined;
  }
}
