import { useState } from 'react';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { RecipeImage } from '../components/RecipeImage';
import { RecipeVideo } from '../components/RecipeVideo';
import { useI18n } from '../i18n';
import { useTranslationStatus } from '../lib/translation';
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
  const { t, decimal, lang } = useI18n();
  const translation = useTranslationStatus(recipe.id, lang);
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
    flash(t('detail.addedToGrocery', { count: lines.filter((l) => !isHeading(l)).length }));
  };

  const remove = () => {
    if (confirm(t('detail.confirmDelete', { title: recipe.title }))) {
      deleteRecipe(recipe.id);
      navigate('/');
    }
  };

  const source = httpUrl(recipe.sourceUrl);
  const time = [
    recipe.prepMinutes && t('detail.prep', { time: formatMinutes(recipe.prepMinutes) }),
    recipe.cookMinutes && t('detail.cook', { time: formatMinutes(recipe.cookMinutes) }),
  ].filter(Boolean);

  return (
    <article className="recipe-detail">
      <div className="detail-hero">
        <RecipeImage className="hero-image" src={recipe.image} title={recipe.title} />
        <div className="hero-actions">
          <a className="icon-btn" href="#/" aria-label={t('detail.back')}>
            <Icon name="back" size={20} />
          </a>
          <span className="spacer" />
          <button className="icon-btn" onClick={() => toggleFavorite(recipe.id)} aria-label={t('detail.favorite')} aria-pressed={recipe.favorite}>
            <Icon name="heart" size={20} filled={recipe.favorite} />
          </button>
          <a className="icon-btn" href={`#/recipe/${recipe.id}/edit`} aria-label={t('detail.edit')}>
            <Icon name="edit" size={20} />
          </a>
          <button className="icon-btn" onClick={remove} aria-label={t('detail.delete')}>
            <Icon name="trash" size={20} />
          </button>
        </div>
      </div>

      <h1>{recipe.title}</h1>
      {translation && (
        <p className="muted small" role="status">
          {translation === 'pending' ? t('detail.translating') : t('detail.translationFailed')}
        </p>
      )}
      {recipe.description && <p className="lead">{recipe.description}</p>}
      <p className="muted small">
        {time.join(' · ')}
        {source && (
          <>
            {time.length > 0 && ' · '}
            <a href={source.href} target="_blank" rel="noreferrer noopener">
              {t('detail.source', { host: source.hostname.replace(/^www\./, '') })}
            </a>
          </>
        )}
      </p>
      {recipe.tags.length > 0 && (
        <div className="chips">
          {recipe.tags.map((tag) => (
            <span key={tag} className="chip static">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {recipe.videoUrl && <RecipeVideo url={recipe.videoUrl} />}

      <div className="action-row">
        <a className="btn primary" href={`#/recipe/${recipe.id}/cook`}>
          {t('detail.startCooking')}
        </a>
        <button className="btn" onClick={() => setPlanOpen(true)}>
          {t('detail.addToPlan')}
        </button>
        <button className="btn" onClick={addToGrocery}>
          {t('detail.addToGrocery')}
        </button>
      </div>

      <section className="card">
        <div className="section-head">
          <h2>{t('detail.ingredients')}</h2>
          <div className="stepper" aria-label={t('detail.servingsLabel')}>
            <button onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label={t('detail.fewer')}>
              −
            </button>
            <span>{t('detail.servings', { count: servings })}</span>
            <button onClick={() => setServings((s) => s + 1)} aria-label={t('detail.more')}>
              ＋
            </button>
          </div>
        </div>
        {checked.size > 0 && <p className="muted small">{t('detail.checkedHint')}</p>}
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
                  <span>{scaleIngredient(line, factor, decimal)}</span>
                </label>
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="card">
        <h2>{t('detail.steps')}</h2>
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
          <h2>{t('detail.notes')}</h2>
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
            flash(t('detail.addedToPlan', { when: label }));
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
  const { t, lang } = useI18n();
  const today = new Date();
  const [slot, setSlot] = useState<MealSlot>('dinner');
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const thisWeekEnd = addDays(startOfWeek(today), 6);

  return (
    <Modal title={t('detail.planTitle')} onClose={onClose}>
      <div className="chips">
        {MEAL_SLOTS.map((s) => (
          <button key={s} className={`chip ${slot === s ? 'active' : ''}`} onClick={() => setSlot(s)}>
            {t(`slot.${s}`)}
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
              onAdded(`${formatDay(d, lang)}, ${t(`slot.${slot}`).toLowerCase()}`);
            }}
          >
            {i === 0 ? t('detail.today') : i === 1 ? t('detail.tomorrow') : formatDay(d, lang)}
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
