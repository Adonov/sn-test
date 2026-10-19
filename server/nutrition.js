// Nutrition estimates with Claude: a meal photo or description, or one serving of a recipe.
import Anthropic from '@anthropic-ai/sdk';

const LANGUAGE_NAMES = {
  en: 'English',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'European Portuguese',
  sl: 'Slovenian',
  hr: 'Croatian',
};

// Units the app uses for each nutrient (see src/lib/nutrition.ts).
const NUTRIENT_UNITS = {
  kcal: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  fiber: 'g',
  sugar: 'g',
  saturatedFat: 'g',
  salt: 'g',
  vitaminA: 'µg',
  vitaminC: 'mg',
  vitaminD: 'µg',
  vitaminB12: 'µg',
  calcium: 'mg',
  iron: 'mg',
  magnesium: 'mg',
  potassium: 'mg',
  zinc: 'mg',
};

const NUTRIENTS_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(Object.keys(NUTRIENT_UNITS).map((k) => [k, { type: 'number' }])),
  required: ['kcal', 'protein', 'carbs', 'fat'],
  additionalProperties: false,
};

const FOODS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'number' },
          unit: { type: 'string', enum: ['g', 'ml'] },
          nutrients: NUTRIENTS_SCHEMA,
        },
        required: ['name', 'amount', 'unit', 'nutrients'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const RECIPE_SCHEMA = {
  type: 'object',
  properties: { perServing: NUTRIENTS_SCHEMA },
  required: ['perServing'],
  additionalProperties: false,
};

const UNITS_TEXT = Object.entries(NUTRIENT_UNITS)
  .map(([k, u]) => `${k} (${u})`)
  .join(', ');

const SYSTEM = `You are a nutrition assistant in a recipe and food-diary app. You estimate the nutritional content of food from photos, descriptions or recipes, the way a dietitian would using standard food composition tables.

- Nutrient keys and units: ${UNITS_TEXT}.
- Always give kcal, protein, carbs and fat. Give the other nutrients when the food is a meaningful source or you can estimate them reasonably; leave them out otherwise.
- Values are for the stated amount (not per 100 g).
- For photos, estimate portion sizes from visual cues (plate size, cutlery, typical servings). List each distinct food separately.
- Food names are short and in the requested language.
- If the photo or text contains no food, return an empty list.`;

/** Expected failure with a code the app translates. */
export class NutritionError extends Error {}

let client;

async function ask(params, anthropic) {
  let response;
  try {
    const api = anthropic ?? (client ??= new Anthropic());
    response = await api.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // If the model declines, Anthropic retries on its recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      ...params,
    });
  } catch (err) {
    // The SDK throws a plain Error (not an APIError) when no credentials are configured.
    if (!(err instanceof Anthropic.APIError)) throw new NutritionError('not_configured', { cause: err });
    throw err;
  }
  if (response.stop_reason === 'refusal') throw new NutritionError('refused');
  const text = response.content.find((block) => block.type === 'text')?.text;
  if (!text) throw new NutritionError('failed');
  return JSON.parse(text);
}

const IMAGE_DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE_CHARS = 4_000_000;

/** Estimates the foods in a meal photo (`image`, a data URL) and/or description (`text`). */
export async function estimateFoods({ image, text, lang }, anthropic) {
  const language = LANGUAGE_NAMES[lang] ?? 'English';
  const content = [];
  if (typeof image === 'string' && image) {
    const m = image.match(IMAGE_DATA_URL);
    if (!m || image.length > MAX_IMAGE_CHARS) throw new NutritionError('invalid_image');
    content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  }
  const description = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
  if (!content.length && !description) throw new NutritionError('invalid_input');
  content.push({
    type: 'text',
    text: `${description ? `What I ate: ${description}\n\n` : ''}Estimate each food and its nutrients. Write the names in ${language}.`,
  });
  const result = await ask(
    {
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: FOODS_SCHEMA } },
      messages: [{ role: 'user', content }],
    },
    anthropic,
  );
  return result.items.filter((item) => item.amount > 0).slice(0, 20);
}

/** Estimates the nutrients of one serving of a recipe. */
export async function estimateRecipe(recipe, anthropic) {
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients.filter((i) => typeof i === 'string') : [];
  const servings = Number(recipe?.servings) || 1;
  if (!ingredients.length || ingredients.length > 80) throw new NutritionError('invalid_input');
  const result = await ask(
    {
      output_config: { effort: 'low', format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: `Recipe: ${String(recipe.title ?? '').slice(0, 200)}\nMakes ${servings} servings.\nIngredients:\n${ingredients
            .map((i) => `- ${i.slice(0, 200)}`)
            .join('\n')}\n\nEstimate the nutrients of ONE serving.`,
        },
      ],
    },
    anthropic,
  );
  return result.perServing;
}
