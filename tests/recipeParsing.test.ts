import { describe, expect, it } from 'vitest';
import { extractRecipeFromHtml, parseDuration, parseRecipeText, stripSocialWrapper } from '../shared/recipeParsing.js';
import { findTimerSeconds } from '../src/lib/timers';

describe('parseDuration', () => {
  it('parses ISO 8601 durations', () => {
    expect(parseDuration('PT1H30M')).toBe(90);
    expect(parseDuration('PT45M')).toBe(45);
    expect(parseDuration('P0DT0H20M')).toBe(20);
    expect(parseDuration('nonsense')).toBeUndefined();
  });
});

describe('extractRecipeFromHtml', () => {
  it('reads schema.org Recipe from a JSON-LD @graph', () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebPage","name":"Blog"},
        {"@type":["Recipe"],"name":"Jabolčna pita &amp; cimet","image":[{"url":"https://x.si/pita.jpg"}],
         "recipeYield":["8","8 kosov"],"prepTime":"PT20M","totalTime":"PT1H","recipeIngredient":["1 kg jabolk","200 g moke"],
         "recipeInstructions":[{"@type":"HowToSection","name":"Testo","itemListElement":[{"@type":"HowToStep","text":"Zgneti testo."}]},
           {"@type":"HowToStep","text":"Peci 40 minut."}],
         "keywords":"Sladica, jabolka"}
      ]}</script></head></html>`;
    const { recipe, method } = extractRecipeFromHtml(html, 'https://x.si/pita');
    expect(method).toBe('structured');
    expect(recipe).toMatchObject({
      title: 'Jabolčna pita & cimet',
      image: 'https://x.si/pita.jpg',
      servings: 8,
      prepMinutes: 20,
      cookMinutes: 40,
      ingredients: ['1 kg jabolk', '200 g moke'],
      steps: ['Testo:', 'Zgneti testo.', 'Peci 40 minut.'],
      tags: ['sladica', 'jabolka'],
      sourceUrl: 'https://x.si/pita',
    });
  });

  it('falls back to an Instagram-style caption in og:description', () => {
    const html = `<meta property="og:title" content="Ana on Instagram" />
      <meta property="og:image" content="https://cdn/x.jpg" />
      <meta property="og:description" content="1,234 likes, 12 comments - ana on May 1, 2025: &quot;Hitri bananin kruh 🍌
Sestavine:
3 banane
200 g moke
Postopek:
1. Banane pretlači.
2. Peci 45 minut.
#banana #pecivo&quot;" />`;
    const { recipe, method } = extractRecipeFromHtml(html, 'https://instagram.com/p/1');
    expect(method).toBe('caption');
    expect(recipe.title).toBe('Hitri bananin kruh 🍌');
    expect(recipe.ingredients).toEqual(['3 banane', '200 g moke']);
    expect(recipe.steps).toEqual(['Banane pretlači.', 'Peci 45 minut.']);
    expect(recipe.tags).toEqual(['banana', 'pecivo']);
    expect(recipe.image).toBe('https://cdn/x.jpg');
  });

  it('reports metadata-only pages', () => {
    const { recipe, method } = extractRecipeFromHtml('<title>Video</title>', 'https://tiktok.com/x');
    expect(method).toBe('metadata');
    expect(recipe.title).toBe('Video');
  });
});

describe('stripSocialWrapper', () => {
  it('removes the likes/comments prefix', () => {
    expect(stripSocialWrapper('12K likes, 300 comments - chef on June 2, 2025: "Pasta"')).toBe('Pasta');
  });
});

describe('parseRecipeText', () => {
  it('guesses sections without headings', () => {
    const recipe = parseRecipeText(`Najboljši humus
• 1 pločevinka čičerike
• 2 žlici tahinija
• sok 1 limone
1. Vse sestavine zmiksaj.
2. Postrezi s pito.`);
    expect(recipe.title).toBe('Najboljši humus');
    expect(recipe.ingredients).toEqual(['1 pločevinka čičerike', '2 žlici tahinija']);
    // Lines without a leading quantity before any steps are hard to classify; they end up as steps.
    expect(recipe.steps).toEqual(['sok 1 limone', 'Vse sestavine zmiksaj.', 'Postrezi s pito.']);
  });

  it('keeps ingredient group headings', () => {
    const recipe = parseRecipeText('Ingredients:\n2 eggs\nZa preliv:\n1 dl smetane\nInstructions:\nMix.');
    expect(recipe.ingredients).toEqual(['2 eggs', 'Za preliv:', '1 dl smetane']);
    expect(recipe.steps).toEqual(['Mix.']);
  });
});

describe('findTimerSeconds', () => {
  it.each([
    ['Kuhaj 15 minut.', 900],
    ['Peci 1 uro na 180 °C.', 3600],
    ['Bake for 10-12 minutes', 600],
    ['Počakaj 30 sekund', 30],
    ['Dodaj 2 stroka česna', undefined],
  ])('%s', (step, seconds) => {
    expect(findTimerSeconds(step)).toBe(seconds);
  });
});
