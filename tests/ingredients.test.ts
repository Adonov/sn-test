import { describe, expect, it } from 'vitest';
import { formatQuantity, parseIngredient, scaleIngredient } from '../src/lib/ingredients';

describe('parseIngredient', () => {
  it.each([
    ['250 g moke', { quantity: 250, unit: 'g', unitKey: 'g', name: 'moke' }],
    ['200g sladkorja', { quantity: 200, unit: 'g', name: 'sladkorja' }],
    ['1 1/2 cups flour', { quantity: 1.5, unit: 'cups', unitKey: 'cup', name: 'flour' }],
    ['½ tsp salt', { quantity: 0.5, unitKey: 'tsp', name: 'salt' }],
    ['1½ žlice olja', { quantity: 1.5, unitKey: 'tbsp', name: 'olja' }],
    ['1,5 dl mleka', { quantity: 1.5, unitKey: 'dl', name: 'mleka' }],
    ['2-3 jajca', { quantity: 2, quantityMax: 3, unit: undefined, name: 'jajca' }],
    ['3 stroki česna', { quantity: 3, unitKey: 'clove', name: 'česna' }],
    ['2 garlic cloves', { quantity: 2, unit: undefined, name: 'garlic cloves' }],
    ['1 large egg', { quantity: 1, unit: undefined, name: 'large egg' }],
  ])('%s', (line, expected) => {
    expect(parseIngredient(line)).toMatchObject(expected);
  });

  it('leaves lines without a quantity untouched', () => {
    expect(parseIngredient('sol in poper po okusu')).toEqual({ raw: 'sol in poper po okusu', name: 'sol in poper po okusu' });
  });
});

describe('formatQuantity', () => {
  it.each([
    [2, '2'],
    [1.5, '1 ½'],
    [0.333, '⅓'],
    [0.75, '¾'],
    [2.4, '2,4'],
    [12.6, '13'],
    [0.999, '1'],
  ])('%d → %s', (value, text) => {
    expect(formatQuantity(value)).toBe(text);
  });
});

describe('scaleIngredient', () => {
  it('scales quantities and ranges', () => {
    expect(scaleIngredient('250 g moke', 2)).toBe('500 g moke');
    expect(scaleIngredient('1 1/2 cups flour', 0.5)).toBe('¾ cups flour');
    expect(scaleIngredient('2-3 jajca', 2)).toBe('4–6 jajca');
  });

  it('keeps lines without quantity and headings', () => {
    expect(scaleIngredient('sol po okusu', 3)).toBe('sol po okusu');
    expect(scaleIngredient('Za omako:', 3)).toBe('Za omako:');
  });
});
