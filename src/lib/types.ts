export interface Recipe {
  id: string;
  title: string;
  description?: string;
  image?: string;
  sourceUrl?: string;
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

export const MEAL_SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Zajtrk' },
  { id: 'lunch', label: 'Kosilo' },
  { id: 'dinner', label: 'Večerja' },
  { id: 'snack', label: 'Prigrizek' },
];

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
  category: string;
  checked: boolean;
  recipeIds: string[];
}

export interface AppState {
  version: 1;
  recipes: Recipe[];
  plan: PlanEntry[];
  grocery: GroceryItem[];
}
