import { describe, expect, it } from 'vitest';
import { extractRecipeFromHtml, parseDuration, parseRecipeText, stripSocialWrapper } from '../shared/recipeParsing.js';
import { findUrl } from '../src/lib/importer';
import { toVideoEmbed } from '../src/lib/video';
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

describe('parseRecipeText in other languages', () => {
  it.each([
    ['Zutaten:\n200 g Mehl\nZubereitung:\nVerrühren.', ['200 g Mehl'], ['Verrühren.']],
    ['Ingredientes:\n2 huevos\nPreparación:\nBatir.', ['2 huevos'], ['Batir.']],
    ['Ingrédients :\n2 œufs\nPréparation :\nMélanger.', ['2 œufs'], ['Mélanger.']],
    ['Ingredienti:\n2 uova\nProcedimento:\nMescolare.', ['2 uova'], ['Mescolare.']],
    ['Ingredientes:\n2 ovos\nModo de preparo:\nMisturar.', ['2 ovos'], ['Misturar.']],
    ['Sastojci:\n2 jaja\nPostupak:\nIzmiješati.', ['2 jaja'], ['Izmiješati.']],
  ])('%s', (text, ingredients, steps) => {
    const recipe = parseRecipeText(text);
    expect(recipe.ingredients).toEqual(ingredients);
    expect(recipe.steps).toEqual(steps);
  });

  it('leaves the title empty when none is found', () => {
    expect(parseRecipeText('Ingredients:\n2 eggs').title).toBe('');
  });
});

describe('findTimerSeconds', () => {
  it.each([
    ['20 Minuten backen', 1200],
    ['Hornear 25 minutos', 1500],
    ['Cuire 1 heure', 3600],
    ['Cuocere per 10 minuti', 600],
    ['Kuhati 2 sata', 7200],
    ['Cozinhe 3 a 4 minutos', 180],
    ['Kuhaj 15 minut.', 900],
    ['Peci 1 uro na 180 °C.', 3600],
    ['Bake for 10-12 minutes', 600],
    ['Počakaj 30 sekund', 30],
    ['Dodaj 2 stroka česna', undefined],
  ])('%s', (step, seconds) => {
    expect(findTimerSeconds(step)).toBe(seconds);
  });
});

describe('findUrl', () => {
  it('extracts the link from shared text', () => {
    expect(findUrl('Poglej ta recept! https://www.instagram.com/reel/abc/?igsh=x.')).toBe('https://www.instagram.com/reel/abc/?igsh=x');
    expect(findUrl('brez povezave')).toBeUndefined();
  });
});

describe('toVideoEmbed', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=10', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/abcDEF12345', 'https://www.youtube-nocookie.com/embed/abcDEF12345'],
    ['https://vimeo.com/123456789', 'https://player.vimeo.com/video/123456789'],
    ['https://www.tiktok.com/@chef/video/7234567890123456789', 'https://www.tiktok.com/embed/v2/7234567890123456789'],
    ['https://www.instagram.com/reel/C1a2b3c4d5/?igsh=x', 'https://www.instagram.com/reel/C1a2b3c4d5/embed/'],
  ])('%s', (link, src) => {
    expect(toVideoEmbed(link)).toMatchObject({ kind: 'iframe', src });
  });

  it('plays direct video files and rejects other links', () => {
    expect(toVideoEmbed('https://cdn.example.com/clip.mp4')).toEqual({ kind: 'file', src: 'https://cdn.example.com/clip.mp4' });
    expect(toVideoEmbed('https://example.com/recipe')).toBeUndefined();
    expect(toVideoEmbed('javascript:alert(1)')).toBeUndefined();
  });
});

describe('video on import', () => {
  it('reads the JSON-LD video and recognizes video posts', () => {
    const html = `<script type="application/ld+json">{"@type":"Recipe","name":"X","recipeIngredient":["1 egg"],
      "video":{"@type":"VideoObject","embedUrl":"https://www.youtube.com/embed/abcDEF12345"}}</script>`;
    expect(extractRecipeFromHtml(html, 'https://blog.example/x').recipe.videoUrl).toBe('https://www.youtube.com/embed/abcDEF12345');
    const reel = extractRecipeFromHtml('<title>Reel</title>', 'https://www.instagram.com/reel/C1a2b3c4d5/');
    expect(reel.recipe.videoUrl).toBe('https://www.instagram.com/reel/C1a2b3c4d5/');
  });
});
