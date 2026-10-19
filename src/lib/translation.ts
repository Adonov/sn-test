import { useEffect, useSyncExternalStore } from 'react';
import type { Language } from '../i18n/languages';
import { needsTranslation, recipeText } from './localize';
import { API_BASE } from './api';
import { getState, setRecipeTranslation } from './store';
import type { Recipe, RecipeText } from './types';

export type TranslationStatus = 'pending' | 'failed';

const status = new Map<string, TranslationStatus>();
const listeners = new Set<() => void>();
let disabled = API_BASE === undefined;
let running = false;

const key = (id: string, lang: Language) => `${id}:${lang}`;

function setStatus(id: string, lang: Language, value: TranslationStatus | undefined) {
  if (value) status.set(key(id, lang), value);
  else status.delete(key(id, lang));
  listeners.forEach((l) => l());
}

/** Whether a recipe is being translated into `lang` right now, or failed to. */
export function useTranslationStatus(id: string, lang: Language): TranslationStatus | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status.get(key(id, lang)),
  );
}

async function requestTranslation(recipe: Recipe, lang: Language): Promise<RecipeText> {
  const res = await fetch(`${API_BASE}/api/translate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recipe: recipeText(recipe), targetLanguage: lang }),
  });
  const data = (await res.json().catch(() => ({}))) as { recipe?: RecipeText; error?: string };
  if (res.status === 503 || res.status === 404) disabled = true; // translation isn't set up on this server
  if (!res.ok || !data.recipe) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.recipe;
}

/** Translates, one at a time, every recipe that isn't available in `lang` yet. */
async function translateMissing(lang: Language) {
  if (running || disabled) return;
  running = true;
  try {
    for (;;) {
      const { recipes, language } = getState();
      if (language && language !== lang) break; // the user switched again; the next run takes over
      const next = recipes.find((r) => needsTranslation(r, lang) && !status.has(key(r.id, lang)));
      if (!next || disabled) break;
      setStatus(next.id, lang, 'pending');
      try {
        const translated = await requestTranslation(next, lang);
        setRecipeTranslation(next.id, lang, translated, next.updatedAt);
        setStatus(next.id, lang, undefined);
      } catch (err) {
        console.warn('Prevod ni uspel', err);
        setStatus(next.id, lang, 'failed');
      }
    }
  } finally {
    running = false;
  }
}

/** Keeps recipes translated into the current UI language. Mounted once in App. */
export function useAutoTranslate(lang: Language, recipes: Recipe[]) {
  useEffect(() => {
    if (recipes.some((r) => needsTranslation(r, lang))) translateMissing(lang);
  }, [lang, recipes]);
}
