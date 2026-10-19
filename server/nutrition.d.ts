import type { Nutrients } from '../src/lib/nutrition';

export interface EstimatedFood {
  name: string;
  amount: number;
  unit: 'g' | 'ml';
  nutrients: Nutrients;
}

export class NutritionError extends Error {}
export function estimateFoods(input: { image?: string; text?: string; lang?: string }, anthropic?: unknown): Promise<EstimatedFood[]>;
export function estimateRecipe(
  recipe: { title?: string; servings?: number; ingredients: string[] },
  anthropic?: unknown,
): Promise<Nutrients>;
