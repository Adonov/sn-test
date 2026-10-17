export interface RecipeDraft {
  title: string;
  description?: string;
  image?: string;
  sourceUrl?: string;
  videoUrl?: string;
  servings?: number;
  prepMinutes?: number;
  cookMinutes?: number;
  ingredients: string[];
  steps: string[];
  tags: string[];
}

/** How the recipe was found: schema.org data, a parsed caption, or only page title/image. */
export type ExtractionMethod = 'structured' | 'caption' | 'metadata';

export function decodeEntities(text: string): string;
export function parseDuration(value: unknown): number | undefined;
export function stripSocialWrapper(text: string): string;
export function extractRecipeFromHtml(html: string, url: string): { recipe: RecipeDraft; method: ExtractionMethod };
export function parseRecipeText(text: string): RecipeDraft;
export function isVideoPageUrl(url: string): boolean;
