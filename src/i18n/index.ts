import { useAppState } from '../lib/store';
import { detectLanguage, type Language } from './languages';
import { de } from './locales/de';
import { en, type MessageKey, type Messages } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { hr } from './locales/hr';
import { it } from './locales/it';
import { pt } from './locales/pt';
import { sl } from './locales/sl';

const MESSAGES: Record<Language, Messages> = { en, de, es, fr, it, pt, sl, hr };

export type TranslateParams = Record<string, string | number>;

export function translate(lang: Language, key: MessageKey, params: TranslateParams = {}): string {
  const message = MESSAGES[lang][key] ?? en[key];
  let text: string;
  if (typeof message === 'string') {
    text = message;
  } else {
    const rule = new Intl.PluralRules(lang).select(Number(params.count ?? 0));
    text = message[rule] ?? message.other;
  }
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export type Translate = (key: MessageKey, params?: TranslateParams) => string;

export interface I18n {
  lang: Language;
  t: Translate;
  /** Decimal separator for scaled quantities: "1.5" in English, "1,5" elsewhere. */
  decimal: string;
}

export function i18nFor(lang: Language): I18n {
  return { lang, t: (key, params) => translate(lang, key, params), decimal: lang === 'en' ? '.' : ',' };
}

/** Current language and translator; re-renders when the language changes. */
export function useI18n(): I18n {
  const { language } = useAppState();
  return i18nFor(language ?? detectLanguage());
}

export type { MessageKey };
export { LANGUAGES, detectLanguage, isLanguage, type Language } from './languages';
