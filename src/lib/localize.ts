import type { Language } from '../i18n/languages';
import { detectTextLanguage } from './textLanguage';
import type { Recipe, RecipeText } from './types';

export function recipeText(r: RecipeText): RecipeText {
  return {
    title: r.title,
    description: r.description,
    ingredients: r.ingredients,
    steps: r.steps,
    notes: r.notes,
    tags: r.tags,
  };
}

/** Language the recipe is written in, falling back to `fallback` when it can't be told. */
export function sourceLanguage(recipe: Recipe, fallback: Language): Language {
  return recipe.lang ?? detectTextLanguage([recipe.title, ...recipe.ingredients, ...recipe.steps].join(' ')) ?? fallback;
}

/** The recipe as it should be shown in `lang`: its translation when one exists, otherwise the original. */
export function localize(recipe: Recipe, lang: Language): Recipe {
  const translation = recipe.translations?.[lang];
  return translation ? { ...recipe, ...translation } : recipe;
}

/** Whether `recipe` still needs a machine translation to be shown in `lang`. */
export function needsTranslation(recipe: Recipe, lang: Language): boolean {
  // Unedited samples have hand-written versions in every language.
  if (recipe.sampleId && recipe.updatedAt === recipe.createdAt) return false;
  if (recipe.translations?.[lang]) return false;
  return sourceLanguage(recipe, lang) !== lang;
}
