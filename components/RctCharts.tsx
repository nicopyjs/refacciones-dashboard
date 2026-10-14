"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export const PALETTE = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#64748b", "#db2777"];

const nf = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

export function fmtCLP(n: number): string {
  return `${n < 0 ? "-" : ""}$${nf.format(Math.abs(Math.round(n)))}`;
}

/** Compacto: $1,2 MM / $34,5 M / $120 mil */
export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${nf2.format(a / 1e9)} MM`;
  if (a >= 1e6) return `${s}$${nf1.format(a / 1e6)} M`;
  if (a >= 1e3) return `${s}$${nf.format(a / 1e3)} mil`;
  return `${s}$${nf.format(a)}`;
}

export function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${nf1.format(n * 100)}%`;
}

export function fmtNum(n: number, d = 0): string {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function labelYm(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MESES[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

export interface Series {
  name: string;
  kind: "bar" | "line" | "area";
  values: (number | null)[];
  color?: string;
  /** línea punteada (referencia) */
  dashed?: boolean;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * p;
}

/** Gráfico de series (barras / líneas / áreas) sobre un eje X categórico. */
export function SeriesChart({
  labels,
  series,
  height = 260,
  format = fmtCompact,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(320, Math.round(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(320, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  const longest = labels.reduce((m, l) => Math.max(m, l.length), 0);
  const rotate = labels.length > 6 && (W - 76) / Math.max(labels.length, 1) < longest * 6.2;
  const H = height;
  const pad = { l: 64, r: 12, t: 12, b: rotate ? 78 : 34 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = labels.length;

  const { min, max } = useMemo(() => {
    let lo = 0;
    let hi = 0;
    for (const s of series) for (const v of s.values) if (v !== null && Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const top = niceMax(hi);
    const bot = lo < 0 ? -niceMax(-lo) : 0;
    return { min: bot, max: top };
  }, [series]);

  if (n === 0) return <div className="rct-empty">Sin datos para mostrar</div>;

  const y = (v: number) => pad.t + ih - ((v - min) / (max - min || 1)) * ih;
  const step = iw / n;
  const x = (i: number) => pad.l + step * i + step / 2;
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  const bars = series.filter((s) => s.kind === "bar");
  const bw = Math.max(2, Math.min(28, (step * 0.7) / Math.max(bars.length, 1)));
  const labelEvery = rotate ? 1 : Math.max(1, Math.ceil((n * (longest * 6.2 + 8)) / iw));
  const zeroY = y(0);

  const pathFor = (s: Series) => {
    let d = "";
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  return (
    <div className="rct-chart" ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--gridline)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="rct-axis">{format(t)}</text>
          </g>
        ))}
        {min < 0 && <line x1={pad.l} x2={W - pad.r} y1={zeroY} y2={zeroY} stroke="var(--baseline)" />}
        {labels.map((l, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={x(i)} y={rotate ? H - pad.b + 14 : H - 12} textAnchor={rotate ? "end" : "middle"} transform={rotate ? `rotate(-40 ${x(i)} ${H - pad.b + 14})` : undefined} className="rct-axis">{rotate && l.length > 16 ? l.slice(0, 15) + "…" : l}</text>
          ) : null
        )}
        {series.map((s, si) => {
          const color = s.color ?? PALETTE[si % PALETTE.length];
          if (s.kind === "area") {
            const first = s.values.findIndex((v) => v !== null);
            if (first < 0) return null;
            const d = pathFor(s);
            const lastIdx = s.values.length - 1 - [...s.values].reverse().findIndex((v) => v !== null);
            return (
              <g key={si}>
                <path d={`${d}L${x(lastIdx)},${zeroY}L${x(first)},${zeroY}Z`} fill={color} opacity="0.14" />
                <path d={d} fill="none" stroke={color} strokeWidth="2" />
              </g>
            );
          }
          if (s.kind === "line")
            return <path key={si} d={pathFor(s)} fill="none" stroke={color} strokeWidth="2" strokeDasharray={s.dashed ? "6 4" : undefined} />;
          const bi = bars.indexOf(s);
          return (
            <g key={si}>
              {s.values.map((v, i) =>
                v === null || v === 0 ? null : (
                  <rect
                    key={i}
                    x={x(i) - (bars.length * bw) / 2 + bi * bw}
                    y={Math.min(y(v), zeroY)}
                    width={bw - 1}
                    height={Math.max(1, Math.abs(y(v) - zeroY))}
                    rx="2"
                    fill={color}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                )
              )}
            </g>
          );
        })}
        {labels.map((_, i) => (
          <rect key={i} x={pad.l + step * i} y={pad.t} width={step} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--baseline)" strokeDasharray="3 3" />}
      </svg>
      {hover !== null && (
        <div className="rct-tip" style={{ left: `${Math.min(Math.max((x(hover) / W) * 100, 14), 86)}%` }}>
          <strong>{labels[hover]}</strong>
          {series.map((s, si) => (
            <div key={si}>
              <i style={{ background: s.color ?? PALETTE[si % PALETTE.length] }} />
              {s.name}: <b>{s.values[hover] === null ? "—" : format(s.values[hover] as number)}</b>
            </div>
          ))}
        </div>
      )}
      <div className="rct-legend">
        {series.map((s, si) => (
          <span key={si}>
            <i style={{ background: s.color ?? PALETTE[si % PALETTE.length] }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontales etiquetadas. */
export function HBars({
  items,
  format = fmtCompact,
  color = "var(--accent)",
  highlight,
}: {
  items: { label: string; value: number }[];
  format?: (n: number) => string;
  color?: string;
  highlight?: string;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  if (items.length === 0) return <div className="rct-empty">Sin datos para mostrar</div>;
  return (
    <div className="rct-hbars">
      {items.map((it) => (
        <div className="rct-hbar" key={it.label} title={`${it.label}: ${fmtCLP(it.value)}`}>
          <div className="lbl">{it.label}</div>
          <div className="track">
            <div style={{ width: `${(Math.abs(it.value) / max) * 100}%`, background: it.label === highlight ? "var(--status-good)" : color }} />
          </div>
          <div className="n">{format(it.value)}</div>
        </div>
      ))}
    </div>
  );
}

/** Torta con leyenda. */
export function Pie({ slices, format = (n: number) => fmtNum(n) }: { slices: { label: string; value: number; color?: string }[]; format?: (n: number) => string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <div className="rct-empty">Sin datos para mostrar</div>;
  let acc = 0;
  const R = 60;
  const cx = 70;
  const cy = 70;
  const arcs = slices.map((sl, i) => {
    const frac = sl.value / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const p = (a: number) => `${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`;
    const d = frac >= 0.9999 ? `M${cx},${cy - R}A${R},${R} 0 1 1 ${cx - 0.01},${cy - R}Z` : `M${cx},${cy}L${p(a0)}A${R},${R} 0 ${large} 1 ${p(a1)}Z`;
    return { d, color: sl.color ?? PALETTE[i % PALETTE.length], sl, frac };
  });
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut" role="img">
        {arcs.map((a) => (
          <path key={a.sl.label} d={a.d} fill={a.color} stroke="var(--surface-1)" strokeWidth="1.5">
            <title>{`${a.sl.label}: ${format(a.sl.value)} (${fmtPct(a.frac)})`}</title>
          </path>
        ))}
      </svg>
      <ul className="donut-legend">
        {arcs.map((a) => (
          <li key={a.sl.label}>
            <i style={{ background: a.color }} />
            <span>{a.sl.label}</span>
            <b>{format(a.sl.value)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontales apiladas al 100%. */
export function Stacked100({
  rows,
  keys,
  colors,
  format = (n: number) => fmtNum(n, 1),
}: {
  rows: { label: string; values: Record<string, number> }[];
  keys: string[];
  colors: Record<string, string>;
  format?: (n: number) => string;
}) {
  if (rows.length === 0) return <div className="rct-empty">Sin datos para mostrar</div>;
  return (
    <div className="rct-hbars">
      <div className="rct-legend" style={{ marginBottom: 6 }}>
        {keys.map((k) => (
          <span key={k}>
            <i style={{ background: colors[k] }} />
            {k}
          </span>
        ))}
      </div>
      {rows.map((r) => {
        const tot = keys.reduce((s, k) => s + (r.values[k] ?? 0), 0) || 1;
        return (
          <div className="rct-hbar" key={r.label}>
            <div className="lbl" title={r.label}>{r.label}</div>
            <div className="track stacked">
              {keys.map((k) => {
                const v = r.values[k] ?? 0;
                return v > 0 ? <div key={k} style={{ width: `${(v / tot) * 100}%`, background: colors[k] }} title={`${k}: ${format(v)}`} /> : null;
              })}
            </div>
            <div className="n">{format(tot)}</div>
          </div>
        );
      })}
    </div>
  );
}
