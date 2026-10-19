import type { Language } from '../i18n/languages';

// Frequent short words that are distinctive enough to tell the app's languages apart in recipes.
const STOPWORDS: Record<Language, string[]> = {
  en: ['the', 'and', 'with', 'of', 'to', 'into', 'until', 'add', 'for', 'minutes', 'cup', 'cups', 'tbsp', 'tsp', 'chopped'],
  de: ['und', 'mit', 'der', 'die', 'das', 'den', 'dem', 'zu', 'für', 'bis', 'ein', 'eine', 'minuten', 'el', 'tl', 'etwas'],
  es: ['el', 'los', 'las', 'y', 'con', 'del', 'para', 'hasta', 'añade', 'minutos', 'una', 'cucharada', 'cucharadas', 'picada'],
  fr: ['le', 'les', 'et', 'avec', 'du', 'des', 'dans', 'pour', 'ajoute', 'ajouter', 'minutes', 'une', 'cuillère', 'au'],
  it: ['il', 'gli', 'e', 'con', 'di', 'del', 'della', 'nel', 'per', 'fino', 'aggiungi', 'minuti', 'cucchiaio', 'cucchiai'],
  pt: ['o', 'os', 'com', 'do', 'da', 'em', 'até', 'junta', 'adiciona', 'minutos', 'uma', 'colher', 'colheres', 'numa'],
  sl: ['in', 'ter', 'na', 'dodaj', 'minut', 'žlica', 'žlici', 'žlice', 'žlička', 'ali', 'pri', 'ga', 'jo', 'še'],
  hr: ['i', 'te', 'na', 'dodaj', 'minuta', 'žlica', 'žlice', 'žličica', 'ili', 'dok', 'ga', 'je', 'još', 'malo'],
};

/** Guesses the language of a recipe text; undefined when there isn't enough evidence. */
export function detectTextLanguage(text: string): Language | undefined {
  const words = text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (words.length < 3) return undefined;
  let best: Language | undefined;
  let bestScore = 0;
  for (const [lang, list] of Object.entries(STOPWORDS) as [Language, string[]][]) {
    const set = new Set(list);
    const score = words.reduce((n, w) => n + (set.has(w) ? 1 : 0), 0);
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : undefined;
}
