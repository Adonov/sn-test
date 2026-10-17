// Duration units in English, Slovenian, Croatian, German, Spanish, Portuguese, French and Italian.
const HOURS = 'hours?|hrs?|stunden?|std|horas?|heures?|ore|ora|sat[ai]?|ur[aeio]?|h';
const MINUTES = 'minut(?:es?|en|os?|i|[aeio])?|mins?';
const SECONDS = 'seconds?|secondes?|secondi|segundos?|sekund(?:en|[aeio])?|secs?|sek|s';
const DURATION = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*(?:(?:-|–|bis|to|a|à|do)\\s*\\d+(?:[.,]\\d+)?\\s*)?(?:(${HOURS})|(${MINUTES})|(${SECONDS}))(?!\\p{L})`,
  'iu',
);

/** Finds the first duration in a step, e.g. "kuhaj 15 minut" → 900 seconds. */
export function findTimerSeconds(step: string): number | undefined {
  const m = step.match(DURATION);
  if (!m) return undefined;
  const value = Number(m[1].replace(',', '.'));
  if (m[2]) return Math.round(value * 3600);
  if (m[3]) return Math.round(value * 60);
  return Math.round(value);
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
