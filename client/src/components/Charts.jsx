import { useMemo, useState } from 'react';

/* Categorical palette — ColorBrewer-inspired, accessible on light & dark. */
export const PALETTE = [
  '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#9333ea', '#ea580c',
  '#0d9488', '#4f46e5', '#b45309', '#be185d', '#15803d',
];

const colorAt = (i) => PALETTE[i % PALETTE.length];

const fmtNum = (n) =>
  n == null
    ? '—'
    : n >= 1000
    ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
    : String(n);

/* ----------------------------------------------------------------------- */
/*  Horizontal bar chart                                                    */
/* ----------------------------------------------------------------------- */
export function HBar({
  data,
  maxRows = 12,
  rowHeight = 26,
  showPercent = true,
  colorBy = 'category',
  emptyLabel = 'No data.',
}) {
  const rows = useMemo(() => {
    const arr = (data || []).filter((r) => r && r.value != null);
    return arr.slice(0, maxRows);
  }, [data, maxRows]);

  const total = useMemo(
    () => (data || []).reduce((a, r) => a + (r.value || 0), 0),
    [data]
  );
  const max = useMemo(
    () => rows.reduce((a, r) => Math.max(a, r.value || 0), 0) || 1,
    [rows]
  );

  if (!rows.length) return <div className="chart-empty">{emptyLabel}</div>;

  return (
    <div className="hbar-list" role="list">
      {rows.map((row, i) => {
        const widthPct = (row.value / max) * 100;
        const pct = total > 0 ? (row.value / total) * 100 : 0;
        const fill =
          colorBy === 'category'
            ? colorAt(i)
            : 'var(--chart-primary, #2563eb)';
        return (
          <div
            key={i}
            className="hbar-row"
            style={{ minHeight: rowHeight }}
            role="listitem"
            title={`${row.label}: ${row.value}${
              total > 0 ? ` (${pct.toFixed(1)}%)` : ''
            }`}
          >
            <div className="hbar-label">{row.label}</div>
            <div className="hbar-track">
              <div
                className="hbar-fill"
                style={{ width: `${widthPct}%`, background: fill }}
              />
            </div>
            <div className="hbar-value">
              <strong>{fmtNum(row.value)}</strong>
              {showPercent && total > 0 ? (
                <span className="hbar-pct"> · {pct.toFixed(0)}%</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Donut chart                                                              */
/* ----------------------------------------------------------------------- */
export function Donut({ data, size = 160, thickness = 28, centerLabel }) {
  const rows = useMemo(
    () => (data || []).filter((r) => r && r.value > 0),
    [data]
  );
  const total = rows.reduce((a, r) => a + r.value, 0);
  const r = size / 2;
  const inner = r - thickness;
  const cx = r;
  const cy = r;

  if (!total) return <div className="chart-empty">No data.</div>;

  let acc = 0;
  const arcs = rows.map((row, i) => {
    const start = acc / total;
    acc += row.value;
    const end = acc / total;
    const path = arcPath(cx, cy, r, inner, start, end);
    return { path, color: colorAt(i), row, start, end };
  });

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill={a.color} opacity={0.9}>
            <title>
              {a.row.label}: {a.row.value} (
              {((a.row.value / total) * 100).toFixed(1)}%)
            </title>
          </path>
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="donut-center-value"
        >
          {fmtNum(total)}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          className="donut-center-label"
        >
          {centerLabel || 'total'}
        </text>
      </svg>
      <ul className="donut-legend">
        {arcs.map((a, i) => (
          <li key={i}>
            <span className="legend-swatch" style={{ background: a.color }} />
            <span className="legend-label">{truncate(a.row.label, 26)}</span>
            <span className="legend-value">
              {fmtNum(a.row.value)} ·{' '}
              {((a.row.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function arcPath(cx, cy, rOuter, rInner, startFrac, endFrac) {
  // Avoid 360° fill edge case
  if (endFrac - startFrac >= 0.9999) {
    return [
      `M ${cx - rOuter} ${cy}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${cx + rOuter} ${cy}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${cx - rOuter} ${cy}`,
      `M ${cx - rInner} ${cy}`,
      `A ${rInner} ${rInner} 0 1 0 ${cx + rInner} ${cy}`,
      `A ${rInner} ${rInner} 0 1 0 ${cx - rInner} ${cy}`,
      'Z',
    ].join(' ');
  }
  const a0 = startFrac * Math.PI * 2 - Math.PI / 2;
  const a1 = endFrac * Math.PI * 2 - Math.PI / 2;
  const large = endFrac - startFrac > 0.5 ? 1 : 0;
  const x0 = cx + rOuter * Math.cos(a0);
  const y0 = cy + rOuter * Math.sin(a0);
  const x1 = cx + rOuter * Math.cos(a1);
  const y1 = cy + rOuter * Math.sin(a1);
  const xi1 = cx + rInner * Math.cos(a1);
  const yi1 = cy + rInner * Math.sin(a1);
  const xi0 = cx + rInner * Math.cos(a0);
  const yi0 = cy + rInner * Math.sin(a0);
  return [
    `M ${x0} ${y0}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1}`,
    `L ${xi1} ${yi1}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${xi0} ${yi0}`,
    'Z',
  ].join(' ');
}

/* ----------------------------------------------------------------------- */
/*  Heatmap (row × col matrix)                                              */
/* ----------------------------------------------------------------------- */
export function Heatmap({
  rows,
  cols,
  rowLabels = {},
  colLabels = {},
  matrix, // matrix[rowKey][colKey] = value
  cellSize = 36,
  rowHeader = '',
  colHeader = '',
}) {
  const max = useMemo(() => {
    let m = 0;
    rows.forEach((r) => {
      cols.forEach((c) => {
        const v = matrix?.[r]?.[c] || 0;
        if (v > m) m = v;
      });
    });
    return m;
  }, [rows, cols, matrix]);

  const colHeadH = 70;
  const rowHeadW = 130;
  const w = rowHeadW + cols.length * cellSize + 8;
  const h = colHeadH + rows.length * cellSize + 8;

  if (max === 0) {
    return <div className="chart-empty">No matrix data yet.</div>;
  }

  return (
    <div className="heatmap-wrap" style={{ overflowX: 'auto' }}>
      <svg width={w} height={h} className="heatmap-svg">
        {/* col headers */}
        {cols.map((c, i) => {
          const x = rowHeadW + i * cellSize + cellSize / 2;
          const lbl = truncate(colLabels[c] || c, 14);
          return (
            <g key={`ch-${c}`} transform={`translate(${x}, ${colHeadH - 6})`}>
              <text
                transform="rotate(-40)"
                className="heatmap-axis"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {lbl}
              </text>
            </g>
          );
        })}
        {/* row headers + cells */}
        {rows.map((r, ri) => {
          const y = colHeadH + ri * cellSize;
          return (
            <g key={`r-${r}`}>
              <text
                x={rowHeadW - 8}
                y={y + cellSize / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="heatmap-axis"
              >
                {truncate(rowLabels[r] || r, 18)}
              </text>
              {cols.map((c, ci) => {
                const v = matrix?.[r]?.[c] || 0;
                const alpha = max ? Math.max(v ? 0.12 : 0, v / max) : 0;
                const x = rowHeadW + ci * cellSize;
                return (
                  <g key={`${r}-${c}`}>
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={cellSize - 2}
                      height={cellSize - 2}
                      rx={3}
                      fill={v > 0 ? `rgba(37, 99, 235, ${alpha})` : 'transparent'}
                      stroke="var(--color-border, #e5e7eb)"
                    />
                    {v > 0 && (
                      <text
                        x={x + cellSize / 2}
                        y={y + cellSize / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="heatmap-cell-text"
                        style={{ fill: alpha > 0.55 ? '#fff' : 'var(--color-text, #111827)' }}
                      >
                        {fmtNum(v)}
                      </text>
                    )}
                    <title>
                      {rowLabels[r] || r} × {colLabels[c] || c}: {v}
                    </title>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {(rowHeader || colHeader) && (
        <div className="heatmap-axis-labels">
          {rowHeader && <span>↓ {rowHeader}</span>}
          {colHeader && <span>→ {colHeader}</span>}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Line / area chart                                                       */
/* ----------------------------------------------------------------------- */
export function LineChart({
  series, // [{ name, color, points: [{x, y}] }]
  height = 220,
  yLabel = '',
}) {
  const allPoints = useMemo(
    () => series.flatMap((s) => s.points || []),
    [series]
  );

  if (!allPoints.length) {
    return <div className="chart-empty">No trend data.</div>;
  }

  // collect ordered x values (assume already sorted)
  const xs = Array.from(new Set(allPoints.map((p) => p.x)));
  xs.sort();
  const yMax = Math.max(1, ...allPoints.map((p) => p.y));

  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 36;
  const width = 720;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const xAt = (x) => {
    const idx = xs.indexOf(x);
    return padL + (xs.length === 1 ? innerW / 2 : (idx / (xs.length - 1)) * innerW);
  };
  const yAt = (y) => padT + innerH - (y / yMax) * innerH;

  const yTicks = niceTicks(yMax, 4);

  return (
    <div className="chart-wrap" style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} className="chart-svg">
        {/* y grid */}
        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line
              x1={padL}
              x2={width - padR}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="var(--color-border, #e5e7eb)"
              strokeDasharray="2 3"
            />
            <text
              x={padL - 6}
              y={yAt(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="chart-axis"
            >
              {fmtNum(t)}
            </text>
          </g>
        ))}

        {/* x labels — show up to ~12 evenly spaced */}
        {pickEven(xs, 12).map((x, i) => (
          <text
            key={`x-${i}`}
            x={xAt(x)}
            y={height - padB + 16}
            textAnchor="middle"
            className="chart-axis"
          >
            {x}
          </text>
        ))}

        {/* series */}
        {series.map((s, si) => {
          const pts = (s.points || []).map((p) => `${xAt(p.x)},${yAt(p.y)}`).join(' ');
          const color = s.color || colorAt(si);
          return (
            <g key={`s-${si}`}>
              <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {(s.points || []).map((p, pi) => (
                <circle
                  key={pi}
                  cx={xAt(p.x)}
                  cy={yAt(p.y)}
                  r={3}
                  fill={color}
                >
                  <title>
                    {s.name} · {p.x}: {p.y}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}

        {yLabel && (
          <text
            x={10}
            y={padT + innerH / 2}
            transform={`rotate(-90 10 ${padT + innerH / 2})`}
            textAnchor="middle"
            className="chart-axis"
          >
            {yLabel}
          </text>
        )}
      </svg>

      <div className="chart-legend">
        {series.map((s, si) => (
          <span key={si} className="legend-chip">
            <span
              className="legend-swatch"
              style={{ background: s.color || colorAt(si) }}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function niceTicks(max, count) {
  if (max <= count) {
    const arr = [];
    for (let i = 0; i <= max; i++) arr.push(i);
    return arr;
  }
  const step = Math.ceil(max / count);
  const ticks = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(max);
  return ticks;
}

function pickEven(arr, n) {
  if (arr.length <= n) return arr;
  const step = Math.max(1, Math.floor(arr.length / n));
  const out = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

/* ----------------------------------------------------------------------- */
/*  Stacked bar (horizontal — for rate breakdowns)                          */
/* ----------------------------------------------------------------------- */
export function StackedBar({ segments, height = 18, showLegend = true }) {
  const total = segments.reduce((a, s) => a + (s.value || 0), 0);
  if (!total) return <div className="chart-empty">No data.</div>;

  return (
    <div>
      <div
        className="stacked-bar"
        style={{ height }}
        role="img"
        aria-label="Stacked bar"
      >
        {segments.map((s, i) => {
          const pct = (s.value / total) * 100;
          return (
            <div
              key={i}
              className="stacked-bar-seg"
              style={{
                width: `${pct}%`,
                background: s.color || colorAt(i),
              }}
              title={`${s.label}: ${s.value} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      {showLegend && (
        <div className="chart-legend">
          {segments.map((s, i) => {
            const pct = (s.value / total) * 100;
            return (
              <span key={i} className="legend-chip">
                <span
                  className="legend-swatch"
                  style={{ background: s.color || colorAt(i) }}
                />
                {s.label} · {fmtNum(s.value)} ({pct.toFixed(0)}%)
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Stat cards (KPI tiles)                                                  */
/* ----------------------------------------------------------------------- */
export function StatTiles({ items }) {
  return (
    <div className="stat-tiles">
      {items.map((it, i) => (
        <div key={i} className="stat-tile" title={it.hint || ''}>
          <div className="stat-tile-value">{it.value}</div>
          <div className="stat-tile-label">{it.label}</div>
          {it.sub && <div className="stat-tile-sub">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Collapsible "show raw data" wrapper                                     */
/* ----------------------------------------------------------------------- */
export function RawDetails({ label = 'Show raw data', children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="raw-details">
      <button
        type="button"
        className="raw-details-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▾ Hide raw data' : `▸ ${label}`}
      </button>
      {open && <div className="raw-details-body">{children}</div>}
    </div>
  );
}

function truncate(s, n) {
  if (!s) return '';
  const str = String(s);
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}
