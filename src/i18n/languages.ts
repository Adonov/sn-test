export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'sl', name: 'Slovenščina' },
  { code: 'hr', name: 'Hrvatski' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((l) => l.code === value);
}

/** Picks the first supported language from the device/browser settings. */
export function detectLanguage(): Language {
  const preferred = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  for (const tag of preferred) {
    const code = tag.toLowerCase().split('-')[0];
    if (isLanguage(code)) return code;
    // Bosnian and Serbian (Latin) readers understand Croatian best.
    if (code === 'bs' || code === 'sr') return 'hr';
  }
  return 'en';
}
