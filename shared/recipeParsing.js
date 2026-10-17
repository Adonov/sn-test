// Recipe extraction shared by the import API (Node) and the browser ("paste text" import).
// Plain JS so the Node server can run it without a build step; types live in recipeParsing.d.ts.

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  deg: '°',
};

/** Decodes the HTML entities that commonly appear in recipe metadata. */
export function decodeEntities(text) {
  return String(text ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (match, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

function cleanText(text) {
  return decodeEntities(String(text ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Converts an ISO 8601 duration such as "PT1H30M" to minutes. */
export function parseDuration(value) {
  if (typeof value !== 'string') return undefined;
  const m = value.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return undefined;
  const [, d, h, min, s] = m.map((x) => (x === undefined ? 0 : Number(x)));
  const total = Math.round(d * 1440 + h * 60 + min + s / 60);
  return total > 0 ? total : undefined;
}

function parseYield(value) {
  const values = Array.isArray(value) ? value : [value];
  for (const v of values) {
    if (typeof v === 'number' && v > 0) return Math.round(v);
    const m = typeof v === 'string' && v.match(/\d+/);
    if (m) return Number(m[0]);
  }
  return undefined;
}

function pickImage(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return pickImage(value[0]);
  if (typeof value === 'object') return value.url || value.contentUrl || undefined;
  return undefined;
}

function pickVideo(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return pickVideo(value[0]);
  if (typeof value === 'object') return value.embedUrl || value.contentUrl || value.url || undefined;
  return undefined;
}

/** Links to pages that are themselves a video (the recipe video is the post itself). */
export function isVideoPageUrl(url) {
  return /^https?:\/\/([\w-]+\.)*(youtube\.com\/(watch|shorts)|youtu\.be\/|tiktok\.com\/@[^/]+\/video\/|instagram\.com\/(reel|reels|tv)\/|vimeo\.com\/\d)/i.test(
    String(url),
  );
}

function hasType(node, type) {
  const t = node && node['@type'];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

function findRecipeNode(node) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return undefined;
  }
  if (hasType(node, 'Recipe')) return node;
  if (node['@graph']) return findRecipeNode(node['@graph']);
  if (node.mainEntity) return findRecipeNode(node.mainEntity);
  return undefined;
}

function flattenInstructions(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    return cleanLines(value.replace(/<\/(p|li)>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''));
  }
  if (Array.isArray(value)) return value.flatMap(flattenInstructions);
  if (typeof value === 'object') {
    if (hasType(value, 'HowToSection')) {
      const steps = flattenInstructions(value.itemListElement);
      return value.name ? [`${cleanText(value.name)}:`, ...steps] : steps;
    }
    if (value.text) return [cleanText(value.text)].filter(Boolean);
    if (value.name) return [cleanText(value.name)].filter(Boolean);
    if (value.itemListElement) return flattenInstructions(value.itemListElement);
  }
  return [];
}

function toList(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(',');
  return items.map((x) => cleanText(x)).filter(Boolean);
}

function cleanLines(text) {
  return decodeEntities(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeJsonLdRecipe(node, url) {
  const tags = [...toList(node.recipeCategory), ...toList(node.recipeCuisine), ...toList(node.keywords)];
  const ingredients = (node.recipeIngredient || node.ingredients || []).map(cleanText).filter(Boolean);
  const prep = parseDuration(node.prepTime);
  const cook = parseDuration(node.cookTime);
  const total = parseDuration(node.totalTime);
  return {
    title: cleanText(node.name),
    description: cleanText(node.description) || undefined,
    image: pickImage(node.image),
    sourceUrl: url,
    videoUrl: pickVideo(node.video),
    servings: parseYield(node.recipeYield),
    prepMinutes: prep,
    cookMinutes: cook ?? (total && prep ? Math.max(total - prep, 0) || undefined : total),
    ingredients,
    steps: flattenInstructions(node.recipeInstructions),
    tags: [...new Set(tags.map((t) => t.toLowerCase()))].slice(0, 8),
  };
}

function readMeta(html, name) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]*>|<meta[^>]+content=["'][^"']*["'][^>]+(?:property|name)=["']${name}["'][^>]*>`,
    'i',
  );
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=(["'])([\s\S]*?)\1/i)?.[2];
  return content ? decodeEntities(content).trim() : undefined;
}

function readVideoMeta(html) {
  const video = readMeta(html, 'og:video:secure_url') || readMeta(html, 'og:video:url') || readMeta(html, 'og:video');
  return video && /^https?:\/\//i.test(video) ? video : undefined;
}

/**
 * Strips the "123 likes, 4 comments - user on March 1, 2025: "…"" wrapper that
 * Instagram and TikTok put around captions in their og:description.
 */
export function stripSocialWrapper(text) {
  return text
    .replace(/^[\d.,\s]+[KkMm]?\s+(likes?|všečk\w*|me gusta|j['’]aime|mi piace|gefällt|curtidas|sviđa)[^:]*:\s*/i, '')
    .replace(/^[^\n:]{0,80}\bon (Instagram|TikTok)\s*:\s*/i, '')
    .replace(/^["“]|["”]\.?$/g, '')
    .trim();
}

/** Extracts a recipe from a web page: schema.org JSON-LD first, then OpenGraph + caption text. */
export function extractRecipeFromHtml(html, url) {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, raw] of scripts) {
    try {
      const node = findRecipeNode(JSON.parse(raw.trim()));
      if (node) {
        const recipe = normalizeJsonLdRecipe(node, url);
        recipe.videoUrl ||= readVideoMeta(html) || (isVideoPageUrl(url) ? url : undefined);
        return { recipe, method: 'structured' };
      }
    } catch {
      // Malformed JSON-LD is common; try the next block.
    }
  }

  const title = readMeta(html, 'og:title') || cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const description = readMeta(html, 'og:description') || readMeta(html, 'description') || '';
  const image = readMeta(html, 'og:image');
  const parsed = parseRecipeText(stripSocialWrapper(description));
  return {
    recipe: {
      ...parsed,
      title: (parsed.ingredients.length && parsed.title) || title || parsed.title,
      image,
      sourceUrl: url,
      videoUrl: isVideoPageUrl(url) ? url : readVideoMeta(html),
    },
    method: parsed.ingredients.length || parsed.steps.length ? 'caption' : 'metadata',
  };
}

// Section headings in English, Slovenian, Croatian, German, Spanish, Portuguese, French and Italian.
const INGREDIENT_HEADING = new RegExp(
  '^(ingredients?|you[\'’]?ll need|what you need|sestavine|potrebujemo|potrebuje[sš]|sastojci|potrebno je|zutaten|' +
    'ingredientes|ingrédients|ingredienti|' +
    // Group labels such as "Za omako:", "For the sauce:", "Für den Teig:", "Para la masa:", "Pour la pâte :".
    '(?:za|for|für|para|pour|per)\\s+[\\p{L}\'’ ]{2,25})\\s*:?\\s*$',
  'iu',
);
const GROUP_LABEL = /^(za|for|für|para|pour|per)\s/i;
const STEP_HEADING = new RegExp(
  '^(postopek|priprava|navodila|postupak|priprema|instructions?|method|directions|steps|preparation|how to make( it)?|' +
    'zubereitung|anleitung|preparación|elaboración|instrucciones|pasos|modo de prepar[oa]|preparo|preparação|' +
    'préparation|étapes|instructions|preparazione|procedimento)\\s*:?\\s*$',
  'i',
);
const BULLET = /^[\s•·▪●○◦*\-–—>✓✔✅☑👉➡️▶️🔸🔹🔶🔷⭐️🌟💛🧡❤️]+/u;
const NUMBERED_STEP = /^(\d{1,2})[.)]\s+|^(korak|step)\s*\d+\s*[:.)-]?\s*/i;
const STARTS_WITH_QUANTITY = /^(\d+([.,/]\d+)?|[½⅓⅔¼¾⅛])\s*(\p{L}{0,12}\.?\s)?/u;
const HASHTAG = /#[\p{L}\p{N}_]+/gu;

/**
 * Turns free text (e.g. a social media caption or a pasted recipe) into a recipe draft.
 * Uses section headings when present, otherwise guesses line by line.
 */
export function parseRecipeText(text) {
  const tags = [...String(text).matchAll(HASHTAG)].map((m) => m[0].slice(1).toLowerCase());
  const lines = String(text)
    .replace(HASHTAG, '')
    .split(/\r?\n|(?<=\.)\s+(?=\d+[.)]\s)/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && !/^[\p{P}\p{S}\s]+$/u.test(l));

  let title;
  const ingredients = [];
  const steps = [];
  const descriptionLines = [];
  let section = 'unknown';

  for (const line of lines) {
    if (INGREDIENT_HEADING.test(line.replace(BULLET, '').trim())) {
      const heading = line.replace(BULLET, '').trim();
      section = 'ingredients';
      // Sub-headings such as "Za omako:" are kept as group labels.
      if (GROUP_LABEL.test(heading) && ingredients.length) ingredients.push(heading.replace(/\s*:?$/, ':'));
      continue;
    }
    if (STEP_HEADING.test(line.replace(BULLET, '').trim())) {
      section = 'steps';
      continue;
    }

    const stripped = line.replace(BULLET, '').trim();
    if (!stripped) continue;
    const numbered = NUMBERED_STEP.test(stripped);
    const content = stripped.replace(NUMBERED_STEP, '').trim();
    if (!content) continue;

    if (section === 'ingredients' && !numbered) {
      ingredients.push(content);
    } else if (section === 'steps' || numbered) {
      steps.push(content);
    } else if (STARTS_WITH_QUANTITY.test(content) && content.split(' ').length <= 10) {
      ingredients.push(content);
    } else if (!title && !ingredients.length && content.length <= 80) {
      title = content.replace(/[:!.]+$/, '');
    } else if (!ingredients.length) {
      descriptionLines.push(content);
    } else {
      steps.push(content);
    }
  }

  return {
    title: title ?? '',
    description: descriptionLines.join(' ') || undefined,
    ingredients,
    steps,
    tags: [...new Set(tags)].slice(0, 8),
  };
}
