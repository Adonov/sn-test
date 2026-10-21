// Scoring for the AI photo estimate check (see scripts/eval-photos.mjs and eval/README.md).

export const FIELDS = ['kcal', 'protein', 'carbs', 'fat'];

/** Reads answers.csv: file,kcal,protein,carbs,fat (header row; comma or semicolon; decimal comma allowed). */
export function parseAnswers(csv) {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const sep = lines[0]?.includes(';') ? ';' : ',';
  const header = lines.shift()?.split(sep).map((h) => h.trim().toLowerCase()) ?? [];
  if (header[0] !== 'file') throw new Error('answers.csv must start with the header: file,kcal,protein,carbs,fat');
  return lines.map((line) => {
    const cells = line.split(sep).map((c) => c.trim());
    const row = { file: cells[0] };
    header.forEach((h, i) => {
      if (FIELDS.includes(h) && cells[i] !== '' && cells[i] !== undefined) row[h] = Number(cells[i].replace(',', '.'));
    });
    return row;
  });
}

/** Adds up the estimated foods of one photo. */
export function totalOf(items) {
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of items) for (const f of FIELDS) total[f] += item.nutrients?.[f] ?? 0;
  return total;
}

/**
 * Per nutrient: mean absolute error, mean absolute % error, mean signed % error (bias: >0 means
 * the AI overestimates) and the share of photos within ±20 %.
 */
export function summarize(results) {
  const out = {};
  for (const f of FIELDS) {
    const pairs = results.filter((r) => Number.isFinite(r.truth[f]) && r.truth[f] > 0 && r.estimate);
    if (!pairs.length) continue;
    const errors = pairs.map((r) => r.estimate[f] - r.truth[f]);
    const pct = pairs.map((r, i) => errors[i] / r.truth[f]);
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    out[f] = {
      n: pairs.length,
      mae: mean(errors.map(Math.abs)),
      mape: mean(pct.map(Math.abs)) * 100,
      bias: mean(pct) * 100,
      within20: (pct.filter((p) => Math.abs(p) <= 0.2).length / pairs.length) * 100,
    };
  }
  return out;
}
