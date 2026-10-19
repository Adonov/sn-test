import { useState } from 'react';

const W = 320;
const H = 150;
const PAD = { top: 18, right: 8, bottom: 22, left: 8 };

export interface BarDatum {
  label: string;
  value: number;
  /** Text shown in the tooltip and the accessible table. */
  detail: string;
  /** Marks the current day. */
  highlight?: boolean;
}

/** Single-series bar chart with an optional reference line (e.g. the daily calorie goal). */
export function BarChart({ data, reference, referenceLabel, title }: { data: BarDatum[]; reference?: number; referenceLabel?: string; title: string }) {
  const [active, setActive] = useState<number>();
  const max = Math.max(1, reference ?? 0, ...data.map((d) => d.value)) * 1.1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(28, slot - 6);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const shown = active ?? data.findIndex((d) => d.highlight);

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseLeave={() => setActive(undefined)}>
        <line className="chart-baseline" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
        {reference !== undefined && (
          <>
            <line className="chart-reference" x1={PAD.left} x2={W - PAD.right} y1={y(reference)} y2={y(reference)} />
            {referenceLabel && (
              <text className="chart-label" x={W - PAD.right} y={y(reference) - 4} textAnchor="end">
                {referenceLabel}
              </text>
            )}
          </>
        )}
        {data.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, h, barW / 2);
          // Rounded top, square base anchored on the baseline.
          const path = h > 0 ? `M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + barW - r} Q${x + barW},${y(d.value)} ${x + barW},${y(d.value) + r} V${y(0)} Z` : '';
          return (
            <g key={i}>
              {path && <path className={`chart-bar ${shown === i ? 'active' : ''}`} d={path} />}
              <text className={`chart-axis ${d.highlight ? 'strong' : ''}`} x={x + barW / 2} y={H - 6} textAnchor="middle">
                {d.label}
              </text>
              {/* Hit target taller and wider than the bar. */}
              <rect
                x={PAD.left + i * slot}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onTouchStart={() => setActive(i)}
                onFocus={() => setActive(i)}
                tabIndex={0}
                aria-label={`${d.label}: ${d.detail}`}
              />
            </g>
          );
        })}
      </svg>
      {shown >= 0 && data[shown] && (
        <figcaption className="chart-tooltip">
          <strong>{data[shown].label}</strong> · {data[shown].detail}
        </figcaption>
      )}
      <DataTable rows={data.map((d) => [d.label, d.detail])} caption={title} />
    </figure>
  );
}

export interface LinePoint {
  /** Position on the time axis (e.g. days since the first point). */
  x: number;
  value: number;
  label: string;
  detail: string;
}

/** Single-series line chart with crosshair, e.g. body weight over time. */
export function LineChart({ points, target, targetLabel, title }: { points: LinePoint[]; target?: number; targetLabel?: string; title: string }) {
  const [active, setActive] = useState<number>();
  if (points.length === 0) return null;
  const values = points.map((p) => p.value).concat(target ?? []);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;
  const x0 = points[0].x;
  const x1 = Math.max(x0 + 1, points[points.length - 1].x);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + ((x - x0) / (x1 - x0)) * innerW;
  const sy = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const shown = active ?? points.length - 1;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.value)}`).join(' ');

  const nearest = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(sx(p.x) - x) < Math.abs(sx(points[best].x) - x)) best = i;
    });
    setActive(best);
  };

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={title}
        onMouseMove={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
        onTouchMove={(e) => nearest(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setActive(undefined)}
      >
        {target !== undefined && (
          <>
            <line className="chart-reference" x1={PAD.left} x2={W - PAD.right} y1={sy(target)} y2={sy(target)} />
            {targetLabel && (
              <text className="chart-label" x={W - PAD.right} y={sy(target) - 4} textAnchor="end">
                {targetLabel}
              </text>
            )}
          </>
        )}
        <path className="chart-line" d={d} />
        <line className="chart-crosshair" x1={sx(points[shown].x)} x2={sx(points[shown].x)} y1={PAD.top} y2={H - PAD.bottom} />
        <circle className="chart-marker" cx={sx(points[shown].x)} cy={sy(points[shown].value)} r={4} />
        <text className="chart-axis" x={PAD.left} y={H - 6}>
          {points[0].label}
        </text>
        <text className="chart-axis" x={W - PAD.right} y={H - 6} textAnchor="end">
          {points[points.length - 1].label}
        </text>
      </svg>
      <figcaption className="chart-tooltip">
        <strong>{points[shown].label}</strong> · {points[shown].detail}
      </figcaption>
      <DataTable rows={points.map((p) => [p.label, p.detail])} caption={title} />
    </figure>
  );
}

/** The chart's data as a table for screen readers. */
function DataTable({ rows, caption }: { rows: string[][]; caption: string }) {
  return (
    <table className="visually-hidden">
      <caption>{caption}</caption>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
