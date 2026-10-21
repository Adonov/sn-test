import { describe, expect, it } from 'vitest';
import { parseAnswers, summarize, totalOf } from '../scripts/photoEval.js';

describe('parseAnswers', () => {
  it('reads commas, semicolons, decimal commas and comments', () => {
    expect(parseAnswers('file,kcal,protein,carbs,fat\n# note\na.jpg,500,30,50,20\n')).toEqual([
      { file: 'a.jpg', kcal: 500, protein: 30, carbs: 50, fat: 20 },
    ]);
    expect(parseAnswers('File;kcal;protein\nb.jpg;410,5;;\n')).toEqual([{ file: 'b.jpg', kcal: 410.5 }]);
  });

  it('needs the header', () => {
    expect(() => parseAnswers('a.jpg,1,2,3,4')).toThrow();
  });
});

describe('summarize', () => {
  it('reports error, bias and share within 20 %', () => {
    const results = [
      { truth: { kcal: 500 }, estimate: totalOf([{ nutrients: { kcal: 300 } }, { nutrients: { kcal: 250 } }]) },
      { truth: { kcal: 400 }, estimate: totalOf([{ nutrients: { kcal: 200 } }]) },
      { truth: { kcal: 300 } },
    ];
    const s = summarize(results).kcal!;
    expect(s.n).toBe(2);
    expect(s.mae).toBe(125);
    expect(s.mape).toBeCloseTo(30);
    expect(s.bias).toBeCloseTo(-20);
    expect(s.within20).toBe(50);
    expect(summarize(results).protein).toBeUndefined();
  });
});
