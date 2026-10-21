export const FIELDS: ('kcal' | 'protein' | 'carbs' | 'fat')[];
export type Totals = { kcal: number; protein: number; carbs: number; fat: number };
export interface Answer {
  file: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}
export function parseAnswers(csv: string): Answer[];
export function totalOf(items: { nutrients?: Partial<Totals> }[]): Totals;
export function summarize(
  results: { truth: Partial<Totals>; estimate?: Totals }[],
): Partial<Record<keyof Totals, { n: number; mae: number; mape: number; bias: number; within20: number }>>;
