import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { RecipeImage } from '../components/RecipeImage';
import { useI18n } from '../i18n';
import { ApiError } from '../lib/api';
import { toISODate } from '../lib/dates';
import { lookupBarcode, searchFoods, type FoodProduct } from '../lib/foodDb';
import { fileToDataUrl } from '../lib/image';
import { localize } from '../lib/localize';
import { scaleNutrients, type FavoriteFood, type FoodLogEntry, type FoodUnit, type Nutrients } from '../lib/nutrition';
import { recentFoods } from '../lib/nutritionStats';
import { estimateFoods, estimateRecipeNutrition } from '../lib/nutritionApi';
import { navigate } from '../lib/router';
import { scanBarcode } from '../lib/scanner';
import { addDiaryEntries, useAppState } from '../lib/store';
import { MEAL_SLOTS, type MealSlot, type Recipe } from '../lib/types';

/** A food waiting to be confirmed before it goes into the diary. */
interface Draft {
  key: string;
  name: string;
  amount: string;
  unit: FoodUnit;
  perUnit: Nutrients;
  source: FoodLogEntry['source'];
  barcode?: string;
  recipeId?: string;
  /** Manual entries: what the user typed for the whole amount (kept as text so decimals can be typed). */
  manual?: Partial<Record<(typeof MACRO_KEYS)[number], string>>;
}

/** Suggests the meal from the time of day. */
export function slotForNow(date = new Date()): MealSlot {
  const h = date.getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
}

const MACRO_KEYS = ['kcal', 'protein', 'carbs', 'fat'] as const;

let draftKey = 0;
const nextKey = () => String(++draftKey);

function fromProduct(p: FoodProduct, source: Draft['source']): Draft {
  return {
    key: nextKey(),
    name: p.brand ? `${p.name} (${p.brand})` : p.name,
    amount: String(p.servingGrams ?? 100),
    unit: 'g',
    perUnit: p.perGram,
    source,
    barcode: p.barcode,
  };
}


export function AddFood({ date: dateParam, slot: slotParam }: { date?: string; slot?: string }) {
  const { recipes, diary = [], favoriteFoods = [] } = useAppState();
  const recent = useMemo(() => recentFoods(diary), [diary]);
  const { t, lang } = useI18n();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : toISODate(new Date());
  const [slot, setSlot] = useState<MealSlot>(MEAL_SLOTS.includes(slotParam as MealSlot) ? (slotParam as MealSlot) : slotForNow());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodProduct[]>();
  const [busy, setBusy] = useState<'search' | 'ai' | 'scan' | 'recipe'>();
  const [message, setMessage] = useState<string>();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [estimated, setEstimated] = useState(false);
  const [pickingRecipe, setPickingRecipe] = useState(false);
  // What the last AI estimate was based on, so the user can correct it.
  const [aiInput, setAiInput] = useState<{ image?: string; text?: string; source: Draft['source'] }>();
  const [fix, setFix] = useState('');
  const localized = useMemo(() => recipes.map((r) => localize(r, lang)), [recipes, lang]);

  const fail = (err: unknown) => {
    console.warn(err);
    setMessage(err instanceof ApiError && (err.code === 'not_configured' || err.status === 0) ? t('add.aiUnavailable') : t('add.error'));
  };

  const review = (items: Draft[], fromAi = false) => {
    setDrafts(items);
    setEstimated(fromAi);
    setMessage(undefined);
    setResults(undefined);
  };

  const scan = async () => {
    setMessage(undefined);
    const code = await scanBarcode(t('add.scanHint'));
    if (!code) return;
    setBusy('scan');
    try {
      const product = await lookupBarcode(code, lang);
      if (product) review([fromProduct(product, 'barcode')]);
      else setMessage(t('add.notFound'));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(undefined);
    }
  };

  const runAi = async (input: { image?: string; text?: string }, source: Draft['source']) => {
    setBusy('ai');
    setMessage(undefined);
    setAiInput({ ...input, source });
    try {
      const items = await estimateFoods(input, lang);
      if (!items.length) return setMessage(t('add.noResults'));
      review(
        items.map((i) => ({
          key: nextKey(),
          name: i.name,
          amount: String(Math.round(i.amount)),
          unit: i.unit,
          perUnit: scaleNutrients(i.nutrients, 1 / i.amount),
          source,
        })),
        true,
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(undefined);
    }
  };

  const photo = async (file?: File) => {
    if (!file) return;
    try {
      // 1024 px is plenty for recognising food and keeps the upload small.
      await runAi({ image: await fileToDataUrl(file, 1024, 0.8) }, 'photo');
    } catch (err) {
      fail(err);
    }
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy('search');
    setMessage(undefined);
    try {
      const found = await searchFoods(query.trim(), lang);
      setResults(found);
      if (!found.length) setMessage(t('add.noResults'));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(undefined);
    }
  };

  const fromRecipe = async (recipe: Recipe) => {
    setPickingRecipe(false);
    let nutrition = recipe.nutrition;
    if (!nutrition) {
      setBusy('recipe');
      try {
        nutrition = await estimateRecipeNutrition(recipe);
      } catch (err) {
        fail(err);
        return;
      } finally {
        setBusy(undefined);
      }
    }
    review([{ key: nextKey(), name: recipe.title, amount: '1', unit: 'serving', perUnit: nutrition, source: 'recipe', recipeId: recipe.id }], !recipe.nutrition);
  };

  const manual = () =>
    review([{ key: nextKey(), name: query.trim(), amount: '1', unit: 'serving', perUnit: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, source: 'manual', manual: {} }]);

  const fromSaved = (f: Omit<FavoriteFood, 'id'>) =>
    review([{ key: nextKey(), name: f.name, amount: String(f.amount), unit: f.unit, perUnit: f.perUnit, source: 'manual' }]);

  const applyFix = () => {
    if (!aiInput || !fix.trim()) return;
    const previous = drafts.map((d) => `${d.name} ${d.amount} ${d.unit}`).join(', ');
    const text = [aiInput.text, `Previous estimate: ${previous}.`, `Correction from the user: ${fix.trim()}`].filter(Boolean).join('\n');
    setFix('');
    runAi({ image: aiInput.image, text }, aiInput.source);
  };

  const update = (key: string, patch: Partial<Draft>) => setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const amountOf = (d: Draft) => Number(d.amount.replace(',', '.'));
  const valid = drafts.length > 0 && drafts.every((d) => d.name.trim() && amountOf(d) > 0);

  const save = () => {
    addDiaryEntries(
      drafts.map((d) => ({
        date,
        slot,
        name: d.name.trim(),
        amount: amountOf(d),
        unit: d.unit,
        perUnit: d.perUnit,
        source: d.source,
        barcode: d.barcode,
        recipeId: d.recipeId,
      })),
    );
    navigate(`/nutrition/${date}`);
  };

  const slotChips = (
    <div className="chips" role="group" aria-label={t('add.meal')}>
      {MEAL_SLOTS.map((s) => (
        <button key={s} className={`chip ${slot === s ? 'active' : ''}`} onClick={() => setSlot(s)}>
          {t(`slot.${s}`)}
        </button>
      ))}
    </div>
  );

  if (drafts.length) {
    return (
      <>
        <header className="page-header">
          <h1>{t('add.review')}</h1>
        </header>
        {estimated && <p className="notice warn">{t('add.estimated')}</p>}
        {estimated && aiInput && (
          <div className="add-item">
            <input value={fix} onChange={(e) => setFix(e.target.value)} placeholder={t('add.fixPlaceholder')} aria-label={t('add.fix')} />
            <button className="btn" onClick={applyFix} disabled={!fix.trim() || Boolean(busy)}>
              {busy === 'ai' ? t('add.analyzing') : t('add.fix')}
            </button>
          </div>
        )}
        {slotChips}
        {drafts.map((d) => {
          const amount = amountOf(d);
          const total = scaleNutrients(d.perUnit, amount > 0 ? amount : 0);
          return (
            <section key={d.key} className="card">
              <label className="field">
                <span>{t('add.name')}</span>
                <input value={d.name} onChange={(e) => update(d.key, { name: e.target.value })} />
              </label>
              <label className="field">
                <span>
                  {t('add.amount')} ({d.unit === 'serving' ? t('add.serving') : d.unit})
                </span>
                <input inputMode="decimal" value={d.amount} onChange={(e) => update(d.key, { amount: e.target.value })} />
              </label>
              {d.manual ? (
                <div className="grid-2">
                  {MACRO_KEYS.map((k) => (
                    <label key={k} className="field">
                      <span>
                        {t(`nutrient.${k}`)} ({k === 'kcal' ? 'kcal' : 'g'})
                      </span>
                      <input
                        inputMode="decimal"
                        value={d.manual![k] ?? ''}
                        onChange={(e) => {
                          // Typed values are for the whole amount; store them per unit.
                          const text = e.target.value;
                          const v = Number(text.replace(',', '.'));
                          update(d.key, {
                            manual: { ...d.manual, [k]: text },
                            perUnit: Number.isFinite(v) && amount > 0 ? { ...d.perUnit, [k]: v / amount } : d.perUnit,
                          });
                        }}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="muted small">
                  {Math.round(total.kcal ?? 0)} kcal ·{' '}
                  {(['protein', 'carbs', 'fat'] as const).map((k) => `${t(`nutrient.${k}`)} ${Math.round(total[k] ?? 0)} g`).join(' · ')}
                </p>
              )}
              {drafts.length > 1 && (
                <button className="link-btn danger" onClick={() => setDrafts((list) => list.filter((x) => x.key !== d.key))}>
                  {t('common.remove')}
                </button>
              )}
            </section>
          );
        })}
        <div className="action-row sticky-actions">
          <button className="btn" onClick={() => setDrafts([])}>
            {t('editor.cancel')}
          </button>
          <button className="btn primary" onClick={save} disabled={!valid}>
            {t('add.save')}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <h1>{t('add.title')}</h1>
      </header>
      {slotChips}

      <div className="add-methods">
        <button className="method" onClick={scan} disabled={Boolean(busy)}>
          <Icon name="barcode" size={26} />
          <span>{busy === 'scan' ? t('add.searching') : t('add.scan')}</span>
        </button>
        <label className={`method ${busy ? 'disabled' : ''}`}>
          <Icon name="camera" size={26} />
          <span>{busy === 'ai' ? t('add.analyzing') : t('add.photo')}</span>
          <input type="file" accept="image/*" capture="environment" hidden disabled={Boolean(busy)} onChange={(e) => photo(e.target.files?.[0])} />
        </label>
      </div>

      <form className="card" onSubmit={search}>
        <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('add.search')} />
        <div className="action-row">
          <button className="btn" disabled={Boolean(busy) || !query.trim()}>
            {busy === 'search' ? t('add.searching') : t('add.searchButton')}
          </button>
          <button type="button" className="btn primary" disabled={Boolean(busy) || !query.trim()} onClick={() => runAi({ text: query }, 'text')}>
            <Icon name="sparkle" size={18} /> {busy === 'ai' ? t('add.analyzing') : t('add.ai')}
          </button>
        </div>
      </form>

      {message && <p className="notice">{message}</p>}

      {results && results.length > 0 && (
        <ul className="card food-list">
          {results.map((p, i) => (
            <li key={p.barcode ?? i}>
              <button className="food-row" onClick={() => review([fromProduct(p, 'search')])}>
                <span>
                  {p.name}
                  {p.brand && <small className="muted block">{p.brand}</small>}
                </span>
                <span className="muted small">{Math.round((p.perGram.kcal ?? 0) * 100)} kcal / 100 g</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {[
        { title: t('add.favorites'), items: favoriteFoods as Omit<FavoriteFood, 'id'>[] },
        { title: t('add.recent'), items: recent },
      ].map(
        (group) =>
          group.items.length > 0 &&
          !results?.length && (
            <section key={group.title} className="card">
              <h2>{group.title}</h2>
              <ul className="food-list">
                {group.items.slice(0, 8).map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <button className="food-row" onClick={() => fromSaved(f)}>
                      <span>{f.name}</span>
                      <span className="muted small">{Math.round((f.perUnit.kcal ?? 0) * f.amount)} kcal</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}

      <div className="action-row">
        <button className="btn" onClick={() => setPickingRecipe((v) => !v)} disabled={Boolean(busy)}>
          {busy === 'recipe' ? t('recipe.estimating') : t('add.fromRecipe')}
        </button>
        <button className="btn" onClick={manual}>
          {t('add.manual')}
        </button>
      </div>

      {pickingRecipe && (
        <section className="card">
          <h2>{t('add.pickRecipe')}</h2>
          {localized.length === 0 && <p className="muted">{t('add.noRecipes')}</p>}
          <ul className="picker-list">
            {localized.map((r) => (
              <li key={r.id}>
                <button onClick={() => fromRecipe(r)}>
                  <RecipeImage className="thumb" src={r.image} title={r.title} />
                  <span>{r.title}</span>
                  {r.nutrition?.kcal !== undefined && <span className="muted small push">{Math.round(r.nutrition.kcal)} kcal</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
