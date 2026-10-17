import { useEffect, useState } from 'react';
import { isHeading } from '../lib/ingredients';
import { findTimerSeconds, formatClock } from '../lib/timers';
import type { Recipe } from '../lib/types';

export function CookMode({ recipe }: { recipe: Recipe }) {
  const steps = recipe.steps.filter((s) => !isHeading(s));
  const [index, setIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [timerEnd, setTimerEnd] = useState<number>();
  const [now, setNow] = useState(Date.now());

  // Keep the screen awake while cooking, where supported.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    const request = () =>
      navigator.wakeLock
        ?.request('screen')
        .then((l) => (lock = l))
        .catch(() => {});
    request();
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!timerEnd) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timerEnd]);

  const remaining = timerEnd ? Math.max(0, Math.round((timerEnd - now) / 1000)) : undefined;

  useEffect(() => {
    if (remaining === 0) {
      navigator.vibrate?.([300, 150, 300]);
      beep();
    }
  }, [remaining]);

  const step = steps[index] ?? '';
  const timerSeconds = findTimerSeconds(step);

  return (
    <div className="cook-mode">
      <header className="cook-header">
        <a className="icon-btn" href={`#/recipe/${recipe.id}`} aria-label="Zapri način kuhanja">
          ✕
        </a>
        <span className="cook-title">{recipe.title}</span>
        <button className="btn small" onClick={() => setShowIngredients((v) => !v)}>
          {showIngredients ? 'Koraki' : 'Sestavine'}
        </button>
      </header>

      {showIngredients ? (
        <ul className="cook-ingredients">
          {recipe.ingredients.map((line, i) => (
            <li key={i} className={isHeading(line) ? 'ingredient-heading' : ''}>
              {line}
            </li>
          ))}
        </ul>
      ) : steps.length === 0 ? (
        <p className="cook-step">Ta recept nima zapisanih korakov.</p>
      ) : (
        <>
          <div className="progress" aria-hidden>
            <div style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
          </div>
          <p className="muted">
            Korak {index + 1} od {steps.length}
          </p>
          <p className="cook-step">{step}</p>
          {timerSeconds && remaining === undefined && (
            <button className="btn" onClick={() => setTimerEnd(Date.now() + timerSeconds * 1000)}>
              ⏲ Zaženi časovnik ({formatClock(timerSeconds)})
            </button>
          )}
        </>
      )}

      {remaining !== undefined && (
        <div className={`timer ${remaining === 0 ? 'done' : ''}`} role="timer">
          <span>{remaining === 0 ? 'Čas je potekel!' : formatClock(remaining)}</span>
          <button className="btn small" onClick={() => setTimerEnd(undefined)}>
            {remaining === 0 ? 'V redu' : 'Ustavi'}
          </button>
        </div>
      )}

      <footer className="cook-nav">
        <button className="btn" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          ← Nazaj
        </button>
        {index < steps.length - 1 ? (
          <button className="btn primary" onClick={() => setIndex((i) => i + 1)}>
            Naprej →
          </button>
        ) : (
          <a className="btn primary" href={`#/recipe/${recipe.id}`}>
            Dober tek! 🎉
          </a>
        )}
      </footer>
    </div>
  );
}

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio may be blocked; vibration and the on-screen message still signal the timer.
  }
}
