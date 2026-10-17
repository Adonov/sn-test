import type { Language } from '../i18n/languages';

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  image?: string;
  sourceUrl?: string;
  /** YouTube/TikTok/Instagram/Vimeo link or a direct video file shown in the recipe. */
  videoUrl?: string;
  servings: number;
  prepMinutes?: number;
  cookMinutes?: number;
  /** One ingredient per line; a line ending in ":" is a group heading. */
  ingredients: string[];
  steps: string[];
  tags: string[];
  notes?: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const CATEGORIES = ['produce', 'meat', 'dairy', 'bakery', 'pantry', 'spices', 'frozen', 'drinks', 'other'] as const;

export type CategoryId = (typeof CATEGORIES)[number];

export interface PlanEntry {
  id: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  slot: MealSlot;
  recipeId: string;
  servings: number;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category: CategoryId;
  checked: boolean;
  recipeIds: string[];
}

export interface AppState {
  version: 1;
  /** Chosen UI language; undefined follows the device language. */
  language?: Language;
  recipes: Recipe[];
  plan: PlanEntry[];
  grocery: GroceryItem[];
}
