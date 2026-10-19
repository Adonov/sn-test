import type { Language } from '../i18n/languages';
import type { FastingState } from './fasting';
import type { Profile } from './goals';
import type { DayActivity, HealthSettings } from './health';
import type { ReminderSettings } from './reminders';
import type { StravaConnection } from './strava';
import type { Workout } from './workouts';
import type { FavoriteFood, FoodLogEntry, Nutrients, NutritionGoals, WeightEntry } from './nutrition';

/** The translatable text of a recipe. */
export interface RecipeText {
  title: string;
  description?: string;
  ingredients: string[];
  steps: string[];
  notes?: string;
  tags: string[];
}

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
  /** Set on built-in sample recipes; unedited samples follow the UI language. */
  sampleId?: string;
  /** Language the recipe was written in; detected from its text when missing. */
  lang?: Language;
  /** Estimated nutrients for one serving, cleared whenever the recipe is edited. */
  nutrition?: Nutrients;
  /** Machine translations of the text, cleared whenever the recipe is edited. */
  translations?: Partial<Record<Language, RecipeText>>;
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
  /** Chosen UI language; undefined follows the device language. Not synced between devices. */
  language?: Language;
  /** When the data last changed on any device; decides which copy wins when syncing. */
  modifiedAt?: number;
  recipes: Recipe[];
  plan: PlanEntry[];
  grocery: GroceryItem[];
  /** Food diary (nutrition tracking). */
  diary?: FoodLogEntry[];
  nutritionGoals?: NutritionGoals;
  profile?: Profile;
  weights?: WeightEntry[];
  /** Water drunk per day in ml, keyed by YYYY-MM-DD. */
  water?: Record<string, number>;
  waterGoal?: number;
  favoriteFoods?: FavoriteFood[];
  fasting?: FastingState;
  /** Workouts entered by hand (workouts from Apple Health / Health Connect stay in `device`). */
  workouts?: Workout[];
  /** When the first-launch setup was finished or skipped. */
  onboardedAt?: number;
  /** Settings and data that belong to this device only. Not synced. */
  device?: DeviceState;
}

export interface DeviceState {
  reminders?: ReminderSettings;
  health?: HealthSettings;
  /** Steps and workouts per day (YYYY-MM-DD) read from Apple Health / Health Connect. */
  activity?: Record<string, DayActivity>;
  /** The last four weeks of workouts from Apple Health / Health Connect. */
  healthWorkouts?: Workout[];
  /** Strava tokens (this device's own authorization). */
  strava?: StravaConnection;
  /** The last four weeks of Strava activities. */
  stravaWorkouts?: Workout[];
  /** Workouts whose fuel question was answered or dismissed. */
  fuelChecked?: string[];
}
