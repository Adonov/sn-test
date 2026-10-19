import type { ReactNode } from 'react';

/** A progress ring with content in the middle (calories left, fasting timer…). */
export function Ring({
  progress,
  size = 168,
  stroke = 12,
  tone = 'accent',
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  tone?: 'accent' | 'blue' | 'over' | 'protein' | 'carbs' | 'fat';
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className={`ring tone-${tone}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        {p > 0 && (
          <circle
            className="ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - p)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="ring-content">{children}</div>
    </div>
  );
}
