import { describe, expect, it } from 'vitest';
import { addToGroceryList, categorize, formatGroceryAmount, normalizeName } from '../src/lib/grocery';

describe('categorize', () => {
  it.each([
    ['paradižniki', 'Sadje in zelenjava'],
    ['rdeča čebula', 'Sadje in zelenjava'],
    ['piščančje prsi', 'Meso in ribe'],
    ['mleka', 'Mlečni izdelki in jajca'],
    ['feta sira', 'Mlečni izdelki in jajca'],
    ['moke', 'Shramba'],
    ['soli', 'Začimbe in omake'],
    ['zelena solata', 'Sadje in zelenjava'],
    ['all-purpose flour', 'Shramba'],
    ['kisla smetana', 'Mlečni izdelki in jajca'],
    ['nekaj čudnega', 'Drugo'],
  ])('%s → %s', (name, category) => {
    expect(categorize(name)).toBe(category);
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
