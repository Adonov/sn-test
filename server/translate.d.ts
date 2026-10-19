import type { RecipeText } from '../src/lib/types';

export class TranslateError extends Error {}
export function readRecipe(input: unknown): Required<RecipeText>;
export function translateRecipe(recipe: RecipeText, targetLanguage: string, anthropic?: unknown): Promise<RecipeText>;
