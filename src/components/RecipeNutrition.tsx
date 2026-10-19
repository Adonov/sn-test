import { useState } from 'react';
import { useI18n } from '../i18n';
import { toISODate } from '../lib/dates';
import { NUTRIENTS, formatNutrient } from '../lib/nutrition';
import { estimateRecipeNutrition } from '../lib/nutritionApi';
import { addDiaryEntries } from '../lib/store';
import type { Recipe } from '../lib/types';
import { slotForNow } from '../pages/AddFood';

/** Nutrition per serving (AI estimate, computed on request) and a shortcut to log a serving. */
export function RecipeNutrition({ recipe, onLogged }: { recipe: Recipe; onLogged: (message: string) => void }) {
  const { t, decimal } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const n = recipe.nutrition;

  const estimate = async () => {
    setBusy(true);
    setError(false);
    try {
      await estimateRecipeNutrition(recipe);
    } catch (err) {
      console.warn(err);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const log = () => {
    addDiaryEntries([
      {
        date: toISODate(new Date()),
        slot: slotForNow(),
        name: recipe.title,
        amount: 1,
        unit: 'serving',
        perUnit: n!,
        source: 'recipe',
        recipeId: recipe.id,
      },
    ]);
    onLogged(t('recipe.logged'));
  };

  return (
    <section className="card">
      <h2>{t('recipe.nutrition')}</h2>
      {n ? (
        <>
          <div className="macro-grid">
            {NUTRIENTS.filter((x) => x.group === 'macro').map((x) => (
              <div key={x.key}>
                <div className="small muted">{t(`nutrient.${x.key}`)}</div>
                <div className="macro-value">{formatNutrient(n[x.key] ?? 0, x.unit, decimal)}</div>
              </div>
            ))}
          </div>
          <p className="muted small">{t('recipe.estimateNote')}</p>
          <button className="btn primary" onClick={log}>
            {t('recipe.log')}
          </button>
        </>
      ) : (
        <>
          <button className="btn" onClick={estimate} disabled={busy}>
            {busy ? t('recipe.estimating') : t('recipe.estimate')}
          </button>
          {error && <p className="error small">{t('add.error')}</p>}
        </>
      )}
    </section>
  );
}
