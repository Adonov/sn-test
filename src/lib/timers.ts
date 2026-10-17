/** Finds the first duration in a step, e.g. "kuhaj 15 minut" → 900 seconds. */
export function findTimerSeconds(step: string): number | undefined {
  const m = step.match(/(\d+(?:[.,]\d+)?)\s*(?:[-–]\s*\d+\s*)?(ur[aeio]?|h|hours?|min(?:ut[aeio]?|utes?)?|sek(?:und[aeo]?)?|s|seconds?)\b/i);
  if (!m) return undefined;
  const value = Number(m[1].replace(',', '.'));
  const unit = m[2].toLowerCase();
  if (unit.startsWith('u') || unit.startsWith('h')) return Math.round(value * 3600);
  if (unit.startsWith('m')) return Math.round(value * 60);
  return Math.round(value);
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
