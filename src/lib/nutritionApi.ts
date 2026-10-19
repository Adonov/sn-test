import { postJson } from './api';
import type { Nutrients } from './nutrition';
import { setRecipeNutrition } from './store';
import type { Recipe } from './types';

export interface EstimatedFood {
  name: string;
  amount: number;
  unit: 'g' | 'ml';
  nutrients: Nutrients;
}

/** Asks the server's AI to recognise foods in a photo (data URL) and/or a description. */
export async function estimateFoods(input: { image?: string; text?: string }, lang: string): Promise<EstimatedFood[]> {
  const { items } = await postJson<{ items: EstimatedFood[] }>('/api/nutrition/estimate', { ...input, lang });
  return items;
}

/** Estimates (and stores) a recipe's nutrients per serving. */
export async function estimateRecipeNutrition(recipe: Recipe): Promise<Nutrients> {
  const { perServing } = await postJson<{ perServing: Nutrients }>('/api/nutrition/recipe', {
    recipe: { title: recipe.title, servings: recipe.servings, ingredients: recipe.ingredients },
  });
  setRecipeNutrition(recipe.id, perServing, recipe.updatedAt);
  return perServing;
}
