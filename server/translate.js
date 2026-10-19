// Recipe translation with Claude. Requires ANTHROPIC_API_KEY (or another Anthropic credential) on the server.
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

const MAX_ITEMS = 80;
const MAX_CHARS = 20_000;

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    ingredients: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'description', 'ingredients', 'steps', 'notes', 'tags'],
  additionalProperties: false,
};

const SYSTEM = `You translate cooking recipes for a recipe app. You receive a recipe as JSON and return the same fields translated into the requested language.

- Translate naturally, the way a cookbook in that language would phrase it.
- Keep every array the same length and in the same order: one translated line per input line.
- Keep all numbers, fractions and ranges exactly as written. Never convert amounts or measurement systems.
- Write ingredient lines as "amount unit ingredient". Use the usual unit words or abbreviations of the target language (for example tbsp → EL in German, žlica in Slovenian, cucharada in Spanish); keep metric units (g, kg, ml, l) unchanged.
- A line ending with ":" is a group heading; keep the trailing colon.
- Tags are short lowercase words.
- Keep empty strings empty. Keep brand names, emoji and URLs unchanged.`;

/** Expected failure with a code the app translates ("error.<code>"). */
export class TranslateError extends Error {}

let client;

function toStringArray(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
}

/** Validates the client payload and returns a clean recipe object. */
export function readRecipe(input) {
  const recipe = {
    title: typeof input?.title === 'string' ? input.title : '',
    description: typeof input?.description === 'string' ? input.description : '',
    ingredients: toStringArray(input?.ingredients),
    steps: toStringArray(input?.steps),
    notes: typeof input?.notes === 'string' ? input.notes : '',
    tags: toStringArray(input?.tags),
  };
  const items = recipe.ingredients.length + recipe.steps.length + recipe.tags.length;
  if (items > MAX_ITEMS || JSON.stringify(recipe).length > MAX_CHARS) throw new TranslateError('too_large');
  return recipe;
}

export async function translateRecipe(recipe, targetLanguage, anthropic) {
  const language = LANGUAGE_NAMES[targetLanguage];
  if (!language) throw new TranslateError('invalid_language');

  let response;
  try {
    const api = anthropic ?? (client ??= new Anthropic());
    response = await api.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Translation needs little reasoning; low effort keeps it fast and cheap.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      // If the model declines, Anthropic retries on its recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: `Translate this recipe into ${language}.\n\n${JSON.stringify(recipe)}` }],
    });
  } catch (err) {
    // The SDK throws a plain Error (not an APIError) when no credentials are configured.
    if (!(err instanceof Anthropic.APIError)) throw new TranslateError('not_configured', { cause: err });
    throw err;
  }

  if (response.stop_reason === 'refusal') throw new TranslateError('refused');
  if (response.stop_reason === 'max_tokens') throw new TranslateError('too_large');
  const text = response.content.find((block) => block.type === 'text')?.text;
  const translated = text ? JSON.parse(text) : undefined;
  // Line-for-line output is what keeps checkboxes, scaling and grocery merging working.
  if (
    !translated ||
    translated.ingredients.length !== recipe.ingredients.length ||
    translated.steps.length !== recipe.steps.length
  ) {
    throw new TranslateError('failed');
  }
  return translated;
}
