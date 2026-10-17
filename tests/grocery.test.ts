import { describe, expect, it } from 'vitest';
import { addToGroceryList, categorize, formatGroceryAmount, normalizeName, toCategoryId } from '../src/lib/grocery';

describe('categorize', () => {
  it.each([
    ['paradižniki', 'produce'],
    ['rdeča čebula', 'produce'],
    ['piščančje prsi', 'meat'],
    ['mleka', 'dairy'],
    ['feta sira', 'dairy'],
    ['moke', 'pantry'],
    ['soli', 'spices'],
    ['zelena solata', 'produce'],
    ['all-purpose flour', 'pantry'],
    ['kisla smetana', 'dairy'],
    ['nekaj čudnega', 'other'],
    ['Mehl', 'pantry'],
    ['Zwiebeln', 'produce'],
    ['schwarzer Pfeffer', 'spices'],
    ['harina', 'pantry'],
    ['pimiento rojo', 'produce'],
    ['pimienta negra', 'spices'],
    ['huevos', 'dairy'],
    ['farine', 'pantry'],
    ['beurre doux', 'dairy'],
    ['pomodori', 'produce'],
    ['petto di pollo', 'meat'],
    ['leite', 'dairy'],
    ['brašna', 'pantry'],
    ['luk', 'produce'],
  ])('%s → %s', (name, category) => {
    expect(categorize(name)).toBe(category);
  });
});

describe('toCategoryId', () => {
  it('maps categories saved by the Slovenian-only version', () => {
    expect(toCategoryId('Sadje in zelenjava')).toBe('produce');
    expect(toCategoryId('dairy')).toBe('dairy');
    expect(toCategoryId('nonsense')).toBe('other');
  });
});

describe('normalizeName', () => {
  it('drops preparation notes', () => {
    expect(normalizeName('čebula, drobno sesekljana')).toBe('čebula');
    expect(normalizeName('maslo (sobne temperature)')).toBe('maslo');
  });
});

describe('addToGroceryList', () => {
  it('merges the same ingredient across recipes and converts metric units', () => {
    let list = addToGroceryList([], ['500 g moke', '1 čebula, sesekljana'], 1, 'a');
    list = addToGroceryList(list, ['1 kg moke', '2 čebula', 'Za omako:'], 1, 'b');
    expect(list).toHaveLength(2);
    const flour = list.find((i) => i.name === 'moke')!;
    expect(flour.quantity).toBe(1500);
    expect(formatGroceryAmount(flour)).toBe('1 ½ kg');
    expect(flour.recipeIds).toEqual(['a', 'b']);
    expect(list.find((i) => i.name === 'čebula')!.quantity).toBe(3);
  });

  it('scales by the serving factor', () => {
    const [item] = addToGroceryList([], ['200 ml mleka'], 2.5);
    expect(item.quantity).toBe(500);
    expect(formatGroceryAmount(item)).toBe('500 ml');
  });

  it('formats decimals with the language separator', () => {
    const [item] = addToGroceryList([], ['1,25 kg Mehl']);
    expect(formatGroceryAmount(item, '.')).toBe('1 ¼ kg');
    const [other] = addToGroceryList([], ['1.3 kg flour']);
    expect(formatGroceryAmount(other, '.')).toBe('1.3 kg');
    expect(formatGroceryAmount(other, ',')).toBe('1,3 kg');
  });

  it('keeps items with incompatible units separate', () => {
    const list = addToGroceryList([], ['2 žlici sladkorja', '100 g sladkorja']);
    expect(list).toHaveLength(2);
  });

  it('does not merge into items already checked off', () => {
    const [first] = addToGroceryList([], ['1 l mleka']);
    const list = addToGroceryList([{ ...first, checked: true }], ['1 l mleka']);
    expect(list).toHaveLength(2);
  });
});
