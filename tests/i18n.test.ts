import { describe, expect, it } from 'vitest';
import { LANGUAGES, translate } from '../src/i18n';
import { en, type MessageKey } from '../src/i18n/locales/en';

describe('translations', () => {
  it.each(LANGUAGES.map((l) => l.code))('%s has every string, with the same placeholders', (lang) => {
    for (const key of Object.keys(en) as MessageKey[]) {
      const text = translate(lang, key, { count: 2 });
      expect(text, key).toBeTruthy();
      const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((p) => p !== 'count').sort();
      expect(placeholders(text), key).toEqual(placeholders(translate('en', key, { count: 2 })));
    }
  });

  it('uses the plural rules of each language', () => {
    expect(translate('en', 'detail.servings', { count: 1 })).toBe('1 serving');
    expect(translate('sl', 'detail.servings', { count: 2 })).toBe('2 porciji');
    expect(translate('sl', 'detail.servings', { count: 3 })).toBe('3 porcije');
    expect(translate('sl', 'detail.servings', { count: 5 })).toBe('5 porcij');
    expect(translate('hr', 'library.ingredientCount', { count: 3 })).toBe('3 sastojka');
    expect(translate('fr', 'detail.servings', { count: 0 })).toBe('0 portion');
  });
});
