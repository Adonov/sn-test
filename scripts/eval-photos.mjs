// Checks how close the AI's photo estimates come to known values.
// Usage: npm run eval:photos  (photos and answers.csv in eval/photos, see eval/README.md)
// Every photo is one real AI request (about $0.04 each), so it needs ANTHROPIC_API_KEY in .env.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateFoods } from '../server/nutrition.js';
import { FIELDS, parseAnswers, summarize, totalOf } from './photoEval.js';

try {
  process.loadEnvFile?.(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // No .env: the key may come from the environment.
}
const dir = process.argv[2] ?? 'eval/photos';
const lang = process.env.EVAL_LANG ?? 'sl';
const answersPath = join(dir, 'answers.csv');
if (!existsSync(answersPath)) {
  console.error(`Missing ${answersPath}. See eval/README.md.`);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), 'taisty-eval-'));
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** The photo as the app sends it: at most 900 px, JPEG (on a Mac, sips also converts HEIC). */
function dataUrl(file) {
  const ext = file.split('.').pop().toLowerCase();
  if (process.platform === 'darwin') {
    const out = join(tmp, 'photo.jpg');
    execFileSync('sips', ['-Z', '900', '-s', 'format', 'jpeg', '-s', 'formatOptions', '75', file, '--out', out], { stdio: 'ignore' });
    return `data:image/jpeg;base64,${readFileSync(out).toString('base64')}`;
  }
  if (!MIME[ext]) throw new Error(`${file}: use JPEG, PNG or WebP (or run this on a Mac)`);
  return `data:${MIME[ext]};base64,${readFileSync(file).toString('base64')}`;
}

const answers = parseAnswers(readFileSync(answersPath, 'utf8'));
const results = [];
const csv = ['file,' + FIELDS.map((f) => `${f},${f}_ai`).join(',') + ',foods'];
for (const [i, a] of answers.entries()) {
  const file = join(dir, a.file);
  process.stdout.write(`[${i + 1}/${answers.length}] ${a.file} … `);
  try {
    const items = await estimateFoods({ image: dataUrl(file), lang });
    const estimate = totalOf(items);
    results.push({ truth: a, estimate });
    console.log(`${Math.round(estimate.kcal)} kcal (prav: ${a.kcal ?? '?'})`);
    csv.push(
      [a.file, ...FIELDS.flatMap((f) => [a[f] ?? '', Math.round(estimate[f])]), `"${items.map((x) => `${x.name} ${x.amount}${x.unit}`).join('; ')}"`].join(','),
    );
  } catch (err) {
    console.log(`napaka: ${err.message}`);
    results.push({ truth: a });
  }
}
rmSync(tmp, { recursive: true, force: true });

const label = { kcal: 'Kalorije', protein: 'Beljakovine', carbs: 'Ogljikovi hidrati', fat: 'Maščobe' };
const unit = { kcal: 'kcal', protein: 'g', carbs: 'g', fat: 'g' };
console.log('\nRezultat (povprečno na fotografijo):');
for (const [f, s] of Object.entries(summarize(results))) {
  console.log(
    `  ${label[f].padEnd(18)} odstopanje ±${Math.round(s.mae)} ${unit[f]} (${Math.round(s.mape)} %), ` +
      `${s.bias >= 0 ? 'preceni' : 'podceni'} za ${Math.abs(Math.round(s.bias))} %, ` +
      `znotraj ±20 %: ${Math.round(s.within20)} % fotografij (n=${s.n})`,
  );
}
const report = join(dir, 'results.csv');
writeFileSync(report, csv.join('\n') + '\n');
console.log(`\nPodrobnosti: ${report}`);
