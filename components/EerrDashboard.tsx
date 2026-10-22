"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EerrData, EerrLine } from "@/lib/eerr/types";
import TopNav from "./TopNav";
import { HBars, SeriesChart, Stacked100, fmtCLP, fmtNum, fmtPct, labelYm } from "./RctCharts";
import "../app/dashboard.css";
import "../app/rct/rct.css";
import "../app/estado-resultado/eerr.css";
import MonthPicker from "./MonthPicker";

const C_VENTA = "#16a34a";
const C_GASTO = "#dc2626";
const C_PRES = "#2563eb";
const C_UTIL = "#d97706";

const TG_DIRECTO = "Gasto Directo";
const TG_INDIRECTO = "Gasto Indirecto";
const CUENTA_REMUN_DIRECTA = "4510401003"; // REMUNERACIONES DIRECTAS
const TG_ADMIN = "Gasto Administrativo";
const TIPOS = [TG_DIRECTO, TG_INDIRECTO, TG_ADMIN];
const TIPO_COLOR: Record<string, string> = { [TG_DIRECTO]: "#2563eb", [TG_INDIRECTO]: "#d97706", [TG_ADMIN]: "#7c3aed" };
const SIN_CLASIF = "(sin clasificación)";

/** month: meses elegidos ("01".."12"); vacío = todos. */
type Eco = "Con" | "Sin"; // con / sin provisiones
const CUENTA_PROVISION = "3110101002";
interface Filters { year: string; month: string[]; cn: string; eco: Eco }

const TABS = [
  { id: "ingresos", label: "Ingresos" },
  { id: "detIngresos", label: "Detalles Ingresos" },
  { id: "egresos", label: "Egresos" },
  { id: "detEgresos", label: "Detalle Egresos" },
  { id: "resultado", label: "Estado de resultados" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
const div = (a: number, b: number): number | null => (b ? a / b : null);
const money = (n: number | null) => (n === null ? "—" : fmtCLP(n));

function monthRange(yms: string[]): string[] {
  if (yms.length === 0) return [];
  const sorted = [...new Set(yms)].sort();
  const [y0, m0] = sorted[0].split("-").map(Number);
  const [y1, m1] = sorted[sorted.length - 1].split("-").map(Number);
  const out: string[] = [];
  let y = y0;
  let m = m0;
  while (y < y1 || (y === y1 && m <= m1)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function monthly<T extends { d: string }>(rows: T[], months: string[], f: (r: T) => number): number[] {
  const acc = new Map<string, number>();
  for (const r of rows) acc.set(r.d.slice(0, 7), (acc.get(r.d.slice(0, 7)) ?? 0) + f(r));
  return months.map((m) => acc.get(m) ?? 0);
}

function groupSum<T>(rows: T[], key: (r: T) => string, f: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + f(r));
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/** Verde si el desvío es favorable: en ingresos, sobre lo presupuestado; en gastos, bajo lo presupuestado. */
function tone(v: number | null, gasto: boolean): string | undefined {
  if (v === null || v === 0) return undefined;
  const bueno = gasto ? v < 0 : v > 0;
  return bueno ? "var(--status-good)" : "var(--status-critical)";
}

/* ───────────── UI base ───────────── */
function Kpi({ v, l, color }: { v: string; l: string; color?: string }) {
  return (
    <div className="stat-tile">
      <div className="v" style={color ? { color } : undefined}>{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="summary" style={{ marginTop: 0 }}>
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

/* ───────────── Contexto filtrado ───────────── */
interface Ctx {
  f: Filters;
  ventas: EerrLine[];
  gastos: EerrLine[];
  months: string[];
  /** El presupuesto es del área completa: no existe por centro de negocio. */
  hayPpto: boolean;
  pptoVentaM: number[];
  pptoGastoM: number[];
  pptoVenta: number;
  pptoGasto: number;
  pptoPorTipo: Record<string, number>;
  data: EerrData;
}

export default function EerrDashboard({ data, error, generatedAt, stale }: { data: EerrData | null; error: string | null; generatedAt: string; stale: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("ingresos");
  const years = useMemo(() => (data ? [...new Set(data.lines.map((l) => l.d.slice(0, 4)))].sort().reverse() : []), [data]);
  const cns = useMemo(() => (data ? [...new Set(data.lines.map((l) => l.cn))].sort() : []), [data]);
  const [f, setF] = useState<Filters>({ year: "", month: [], cn: "all", eco: "Con" });
  const ff: Filters = { ...f, year: f.year || years[0] || "all" };

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const ctx = useMemo<Ctx | null>(() => {
    if (!data) return null;
    const inPeriod = (d: string) => (ff.year === "all" || d.startsWith(ff.year)) && (ff.month.length === 0 || ff.month.includes(d.slice(5, 7)));
    const all = data.lines.filter((l) => inPeriod(l.d) && (ff.cn === "all" || l.cn === ff.cn) && !(ff.eco === "Sin" && l.t === "V" && l.ac === CUENTA_PROVISION));
    const ventas = all.filter((l) => l.t === "V");
    const gastos = all.filter((l) => l.t === "G");
    const hayPpto = ff.cn === "all";
    const pv = hayPpto ? data.pptoVenta.filter((p) => inPeriod(p.d)) : [];
    const pg = hayPpto ? data.pptoGasto.filter((p) => inPeriod(p.d)) : [];
    const yms = [...all.map((l) => l.d.slice(0, 7)), ...pv.map((p) => p.d.slice(0, 7)), ...pg.map((p) => p.d.slice(0, 7))];
    // Con meses elegidos se muestran solo esos (sin rellenar los intermedios).
    const months = ff.month.length ? [...new Set(yms)].sort() : monthRange(yms);
    const pptoPorTipo: Record<string, number> = {};
    for (const p of pg) pptoPorTipo[p.tg] = (pptoPorTipo[p.tg] ?? 0) + p.m;
    return {
      f: ff,
      ventas,
      gastos,
      months,
      hayPpto: pv.length + pg.length > 0,
      pptoVentaM: monthly(pv, months, (p) => p.m),
      pptoGastoM: monthly(pg, months, (p) => p.m),
      pptoVenta: sum(pv, (p) => p.m),
      pptoGasto: sum(pg, (p) => p.m),
      pptoPorTipo,
      data,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ff.year, ff.month.join(","), ff.cn, ff.eco]);

  const head = (
    <>
      <TopNav active="eerr" />
      <header className="page-head">
        <h1>Estado de Resultado RCT</h1>
        <p className="sub">Réplica del reporte «Análisis Estado de Resultado» de Power BI, solo centros de negocio RCT (Refacciones)</p>
        <div className="meta">
          {data && (
            <>
              <span>Movimientos hasta <strong style={{ color: "var(--text-secondary)" }}>{data.ledgerLastDate}</strong> · {fmtNum(data.ledgerRows)} líneas contables leídas</span>
              <span className="dot" />
              <span>Calculado {new Date(generatedAt).toLocaleString("es-CL")}{stale ? " · actualizando en segundo plano" : ""}</span>
              <span className="dot" />
            </>
          )}
          <button type="button" onClick={logout} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0 }}>
            Cerrar sesión
          </button>
        </div>
      </header>
    </>
  );

  if (error || !data || !ctx) {
    return (
      <div className="viz-root">
        <div className="wrap">
          {head}
          <div className="error-box" style={{ marginTop: 20 }}>
            <strong>Error:</strong> {error ?? "Sin datos"}
          </div>
        </div>
      </div>
    );
  }

  const set = (p: Partial<Filters>) => setF({ ...ff, ...p });

  return (
    <div className="viz-root">
      <div className="wrap">
        {head}
        <div className="rct-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="rct-filters">
          <label>
            <span>Año</span>
            <select value={ff.year} onChange={(e) => set({ year: e.target.value })}>
              <option value="all">Todos</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <MonthPicker value={ff.month} onChange={(month) => set({ month })} />
          <label className="wide">
            <span>Centro de negocio</span>
            <select value={ff.cn} onChange={(e) => set({ cn: e.target.value })}>
              <option value="all">Todos</option>
              {cns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="seg" role="group" aria-label="Provisiones">
            <span>Provisiones</span>
            <div>
              {(["Con", "Sin"] as Eco[]).map((e) => (
                <button key={e} className={ff.eco === e ? "on" : ""} onClick={() => set({ eco: e })}>{e === "Sin" ? "Sin provisiones" : "Con provisiones"}</button>
              ))}
            </div>
          </div>
        </div>

        {ff.cn !== "all" && (
          <div className="rct-note" style={{ marginTop: 0, marginBottom: 14 }}>
            El presupuesto se define por área, no por centro de negocio: con un centro seleccionado se muestran solo los montos reales.
          </div>
        )}

        {tab === "ingresos" && <Ingresos c={ctx} />}
        {tab === "detIngresos" && <DetalleIngresos c={ctx} />}
        {tab === "egresos" && <Egresos c={ctx} />}
        {tab === "detEgresos" && <DetalleEgresos c={ctx} />}
        {tab === "resultado" && <Resultado c={ctx} />}

        <footer className="note">
          <strong>Sobre esta página:</strong> considera solo los centros de negocio RCT (área «Refacciones»). Ventas netas = cuentas 3.x y gasto real = cuentas 4.x, leídas de los
          Sheets contables (2021–2026). El tipo de gasto sale de la clasificación del plan de cuentas y, si no la tiene, del centro de negocio (los «General» son indirectos).
          El presupuesto viene de las hojas «Ganancias» y «AnexoPsto». Los montos reflejan el plan de cuentas y los Sheets vigentes, que pueden diferir levemente del último refresco de Power BI.
          {data.sinFecha > 0 && ` ${fmtNum(data.sinFecha)} líneas sin fecha de voucher no se incluyen.`}
        </footer>
      </div>
    </div>
  );
}

/* ───────────── 1. Ingresos ───────────── */
function Ingresos({ c }: { c: Ctx }) {
  const mensual = monthly(c.ventas, c.months, (l) => l.m);
  const real = sum(mensual, (x) => x);
  const desv = real - c.pptoVenta;
  const pct = div(desv, c.pptoVenta);
  const labels = c.months.map(labelYm);
  return (
    <>
      <div className="stats">
        <Kpi v={fmtCLP(real)} l="Ventas netas" color={C_VENTA} />
        <Kpi v={c.hayPpto ? fmtCLP(c.pptoVenta) : "—"} l="Presupuesto de ventas" />
        <Kpi v={c.hayPpto ? fmtCLP(desv) : "—"} l="Desviación (real − presupuesto)" color={c.hayPpto ? tone(desv, false) : undefined} />
        <Kpi v={c.hayPpto ? fmtPct(pct) : "—"} l="% desviación" color={c.hayPpto ? tone(desv, false) : undefined} />
      </div>
      <div className="rct-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <Panel title="Comparación de ingresos" hint="Ventas netas de cada mes frente al presupuesto de ventas del área.">
          <SeriesChart
            labels={labels}
            series={[
              ...(c.hayPpto ? [{ name: "Presupuesto", kind: "bar" as const, values: c.pptoVentaM, color: C_PRES }] : []),
              { name: "Ventas netas", kind: "line" as const, values: mensual, color: C_VENTA },
            ]}
          />
        </Panel>
        <Panel title="Ingresos por centro de negocio" hint="Top 14 del período.">
          <HBars items={groupSum(c.ventas, (l) => l.cn, (l) => l.m).slice(0, 14)} color={C_VENTA} />
        </Panel>
      </div>
    </>
  );
}

/* ───────────── 2. Detalles Ingresos ───────────── */
function DetalleIngresos({ c }: { c: Ctx }) {
  const mensual = monthly(c.ventas, c.months, (l) => l.m);
  const rows = c.months.map((m, i) => ({ m, real: mensual[i], ppto: c.pptoVentaM[i] }));
  const totReal = sum(rows, (r) => r.real);
  const porCn = groupSum(c.ventas, (l) => l.cn, (l) => l.m);
  const cell = (real: number, ppto: number, hay: boolean) => {
    const d = real - ppto;
    return (
      <>
        <td style={{ textAlign: "right" }}>{hay ? fmtCLP(ppto) : "—"}</td>
        <td style={{ textAlign: "right", color: hay ? tone(d, false) : undefined }}>{hay ? fmtCLP(d) : "—"}</td>
        <td style={{ textAlign: "right", color: hay ? tone(d, false) : undefined }}>{hay ? fmtPct(div(d, ppto)) : "—"}</td>
      </>
    );
  };
  return (
    <>
      <section className="summary">
        <h2>Detalle ingresos</h2>
        <p className="hint">Ventas netas, presupuesto y desviación mes a mes.</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th style={{ textAlign: "right" }}>Ventas netas</th>
                <th style={{ textAlign: "right" }}>Presupuesto</th>
                <th style={{ textAlign: "right" }}>Desviación $</th>
                <th style={{ textAlign: "right" }}>% desviación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.m}>
                  <td>{labelYm(r.m)}</td>
                  <td style={{ textAlign: "right" }}>{fmtCLP(r.real)}</td>
                  {cell(r.real, r.ppto, r.ppto !== 0)}
                </tr>
              ))}
              <tr className="eerr-total">
                <td>Total</td>
                <td style={{ textAlign: "right" }}>{fmtCLP(totReal)}</td>
                {cell(totReal, c.pptoVenta, c.hayPpto)}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="summary">
        <h2>Ingresos acumulados según centro de negocio</h2>
        <p className="hint">El presupuesto y la desviación se calculan sobre el área completa (fila total).</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Centro de negocio</th>
                <th style={{ textAlign: "right" }}>Ventas netas</th>
                <th style={{ textAlign: "right" }}>% del total</th>
                <th style={{ textAlign: "right" }}>Presupuesto</th>
                <th style={{ textAlign: "right" }}>Desviación $</th>
                <th style={{ textAlign: "right" }}>% desviación</th>
              </tr>
            </thead>
            <tbody>
              {porCn.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td style={{ textAlign: "right" }}>{fmtCLP(r.value)}</td>
                  <td style={{ textAlign: "right" }}>{fmtPct(div(r.value, totReal))}</td>
                  <td style={{ textAlign: "right" }}>—</td>
                  <td style={{ textAlign: "right" }}>—</td>
                  <td style={{ textAlign: "right" }}>—</td>
                </tr>
              ))}
              <tr className="eerr-total">
                <td>Total RCT</td>
                <td style={{ textAlign: "right" }}>{fmtCLP(totReal)}</td>
                <td style={{ textAlign: "right" }}>{totReal ? "100%" : "—"}</td>
                {cell(totReal, c.pptoVenta, c.hayPpto)}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ───────────── 3. Egresos ───────────── */
function Egresos({ c }: { c: Ctx }) {
  const mensual = monthly(c.gastos, c.months, (l) => -l.m);
  const real = sum(mensual, (x) => x);
  const desv = c.pptoGasto ? real - c.pptoGasto : 0;
  const labels = c.months.map(labelYm);
  const porTipo = c.months.map((m) => {
    const values: Record<string, number> = {};
    for (const l of c.gastos) if (l.d.startsWith(m) && TIPOS.includes(l.tg)) values[l.tg] = (values[l.tg] ?? 0) - l.m;
    return { label: labelYm(m), values };
  });
  return (
    <>
      <div className="stats">
        <Kpi v={fmtCLP(real)} l="Gasto real" color={C_GASTO} />
        <Kpi v={c.hayPpto ? fmtCLP(c.pptoGasto) : "—"} l="Presupuesto de gastos" />
        <Kpi v={c.hayPpto ? fmtCLP(desv) : "—"} l="Desviación (real − presupuesto)" color={c.hayPpto ? tone(desv, true) : undefined} />
        <Kpi v={c.hayPpto ? fmtPct(div(desv, c.pptoGasto)) : "—"} l="% desviación" color={c.hayPpto ? tone(desv, true) : undefined} />
      </div>
      <div className="rct-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <Panel title="Comparación de gastos" hint="Gasto real de cada mes frente al presupuesto de gastos del área.">
          <SeriesChart
            labels={labels}
            series={[
              ...(c.hayPpto ? [{ name: "Presupuesto", kind: "bar" as const, values: c.pptoGastoM, color: C_PRES }] : []),
              { name: "Gasto real", kind: "line" as const, values: mensual, color: C_GASTO },
            ]}
          />
        </Panel>
        <Panel title="Gastos por centro de negocio" hint="Top 14 del período.">
          <HBars items={groupSum(c.gastos, (l) => l.cn, (l) => -l.m).slice(0, 14)} color={C_GASTO} />
        </Panel>
      </div>
      <section className="summary">
        <h2>Comparación tipo de gastos</h2>
        <p className="hint">Composición mensual del gasto real entre directo, indirecto y administrativo.</p>
        <Stacked100 rows={porTipo} keys={TIPOS} colors={TIPO_COLOR} format={(n) => fmtCLP(n)} />
      </section>
    </>
  );
}

/* ───────────── 4. Detalle Egresos ───────────── */
interface Nodo {
  key: string;
  label: string;
  real: number;
  ppto: number | null;
  hijos: Nodo[];
}

const MAX_COMPROBANTES = 150;

function construirArbol(c: Ctx): Nodo[] {
  const pptoTc = new Map<string, number>();
  const pptoT = new Map<string, number>();
  if (c.hayPpto) {
    for (const p of c.data.pptoGasto.filter((p) => (c.f.year === "all" || p.d.startsWith(c.f.year)) && (c.f.month.length === 0 || c.f.month.includes(p.d.slice(5, 7))))) {
      pptoT.set(p.tg, (pptoT.get(p.tg) ?? 0) + p.m);
      pptoTc.set(`${p.tg}|${p.cl}`, (pptoTc.get(`${p.tg}|${p.cl}`) ?? 0) + p.m);
    }
  }
  const tipos = new Map<string, Map<string, Map<string, number>>>();
  for (const l of c.gastos) {
    const cl = l.cl && l.cl !== "null" ? l.cl : SIN_CLASIF;
    const t = tipos.get(l.tg) ?? new Map<string, Map<string, number>>();
    const k = t.get(cl) ?? new Map<string, number>();
    k.set(l.ic, (k.get(l.ic) ?? 0) - l.m);
    t.set(cl, k);
    tipos.set(l.tg, t);
  }
  const out: Nodo[] = [];
  for (const [tg, clases] of tipos) {
    const hijosT: Nodo[] = [];
    for (const [cl, comps] of clases) {
      const hijos = [...comps.entries()]
        .filter(([, v]) => v !== 0)
        .sort((a, b) => b[1] - a[1])
        .map(([ic, v]) => ({ key: `${tg}|${cl}|${ic}`, label: ic, real: v, ppto: null, hijos: [] as Nodo[] }));
      const real = sum(hijos, (h) => h.real);
      if (real !== 0) hijosT.push({ key: `${tg}|${cl}`, label: cl, real, ppto: c.hayPpto ? (pptoTc.get(`${tg}|${cl}`) ?? 0) : null, hijos });
    }
    hijosT.sort((a, b) => b.real - a.real);
    const real = sum(hijosT, (h) => h.real);
    if (real !== 0) out.push({ key: tg, label: tg || "(sin tipo)", real, ppto: c.hayPpto ? (pptoT.get(tg) ?? 0) : null, hijos: hijosT });
  }
  return out.sort((a, b) => TIPOS.indexOf(a.label) - TIPOS.indexOf(b.label));
}

function DetalleEgresos({ c }: { c: Ctx }) {
  const arbol = useMemo(() => construirArbol(c), [c]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (!n.delete(k)) n.add(k);
      return n;
    });
  const totReal = sum(arbol, (n) => n.real);

  const fila = (n: Nodo, nivel: number, expandible: boolean, extra?: string) => {
    const hayPpto = n.ppto !== null && n.ppto !== 0;
    const desv = hayPpto ? n.real - (n.ppto as number) : null;
    return (
      <tr key={n.key} className={`eerr-l${nivel}`}>
        <td style={{ paddingLeft: 10 + nivel * 22 }} className={nivel === 2 ? "wrap-col" : undefined}>
          {expandible ? (
            <button type="button" className="eerr-toggle" onClick={() => toggle(n.key)} aria-expanded={open.has(n.key)}>
              {open.has(n.key) ? "▾" : "▸"} {n.label}
            </button>
          ) : (
            n.label
          )}
          {extra && <span className="eerr-extra">{extra}</span>}
        </td>
        <td style={{ textAlign: "right" }}>{fmtCLP(n.real)}</td>
        <td style={{ textAlign: "right" }}>{hayPpto ? fmtCLP(n.ppto as number) : "—"}</td>
        <td style={{ textAlign: "right", color: tone(desv, true) }}>{desv === null ? "—" : fmtCLP(desv)}</td>
        <td style={{ textAlign: "right", color: tone(desv, true) }}>{desv === null ? "—" : fmtPct(div(desv, n.ppto as number))}</td>
      </tr>
    );
  };

  return (
    <section className="summary">
      <h2>Egresos acumulados según tipo y clasificación de gasto</h2>
      <p className="hint">
        Abre cada tipo de gasto para ver sus clasificaciones y, dentro de ellas, los comprobantes contables. Solo se listan los conceptos con gasto real distinto de cero.
      </p>
      <div className="eerr-actions">
        <button type="button" onClick={() => setOpen(new Set(arbol.flatMap((t) => [t.key, ...t.hijos.map((h) => h.key)])))}>Expandir clasificaciones</button>
        <button type="button" onClick={() => setOpen(new Set())}>Contraer todo</button>
      </div>
      <div className="table-scroll" style={{ maxHeight: 620, overflowY: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo / clasificación / comprobante</th>
              <th style={{ textAlign: "right" }}>Gasto real</th>
              <th style={{ textAlign: "right" }}>Presupuesto</th>
              <th style={{ textAlign: "right" }}>Desviación $</th>
              <th style={{ textAlign: "right" }}>% desviación</th>
            </tr>
          </thead>
          <tbody>
            {arbol.length === 0 && (
              <tr><td colSpan={5} className="rct-empty">Sin gastos en el período</td></tr>
            )}
            {arbol.map((t) => (
              <Fragment key={t.key}>
                {fila(t, 0, true)}
                {open.has(t.key) &&
                  t.hijos.map((cl) => (
                    <Fragment key={cl.key}>
                      {fila(cl, 1, true)}
                      {open.has(cl.key) && (
                        <>
                          {cl.hijos.slice(0, MAX_COMPROBANTES).map((cp) => fila(cp, 2, false))}
                          {cl.hijos.length > MAX_COMPROBANTES && (
                            <tr className="eerr-l2">
                              <td colSpan={5} style={{ paddingLeft: 54 }} className="rct-empty">
                                … y {fmtNum(cl.hijos.length - MAX_COMPROBANTES)} comprobantes más (se muestran los {MAX_COMPROBANTES} de mayor monto)
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                    </Fragment>
                  ))}
              </Fragment>
            ))}
            {arbol.length > 0 && (
              <tr className="eerr-total">
                <td>Total</td>
                <td style={{ textAlign: "right" }}>{fmtCLP(totReal)}</td>
                <td style={{ textAlign: "right" }}>{c.hayPpto ? fmtCLP(c.pptoGasto) : "—"}</td>
                <td style={{ textAlign: "right", color: c.hayPpto ? tone(totReal - c.pptoGasto, true) : undefined }}>{c.hayPpto ? fmtCLP(totReal - c.pptoGasto) : "—"}</td>
                <td style={{ textAlign: "right", color: c.hayPpto ? tone(totReal - c.pptoGasto, true) : undefined }}>{c.hayPpto ? fmtPct(div(totReal - c.pptoGasto, c.pptoGasto)) : "—"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ───────────── 5. Estado de resultados ───────────── */
function Resultado({ c }: { c: Ctx }) {
  const ventas = sum(c.ventas, (l) => l.m);
  const tipo = (t: string) => sum(c.gastos.filter((l) => l.tg === t), (l) => l.m); // negativo
  const directo = tipo(TG_DIRECTO);
  const indirecto = tipo(TG_INDIRECTO);
  const admin = tipo(TG_ADMIN);
  const operacional = ventas + directo;
  const estado = operacional + indirecto;
  const empresa = estado + admin;

  const pV = c.pptoVenta;
  const pD = -(c.pptoPorTipo[TG_DIRECTO] ?? 0);
  const pI = -(c.pptoPorTipo[TG_INDIRECTO] ?? 0);
  const pA = -(c.pptoPorTipo[TG_ADMIN] ?? 0);
  const pOp = pV + pD;
  const pEst = pOp + pI;
  const pEmp = pEst + pA;

  const filas: { label: string; real: number; ppto: number; total?: boolean; gasto?: boolean }[] = [
    { label: "Ventas netas", real: ventas, ppto: pV },
    { label: "(−) Gasto directo", real: directo, ppto: pD, gasto: true },
    { label: "= Resultado operacional", real: operacional, ppto: pOp, total: true },
    { label: "(−) Gasto indirecto", real: indirecto, ppto: pI, gasto: true },
    { label: "= Estado de resultado del área", real: estado, ppto: pEst, total: true },
    { label: "(−) Gasto administrativo", real: admin, ppto: pA, gasto: true },
    { label: "= Estado de resultado empresa", real: empresa, ppto: pEmp, total: true },
  ];
  // Desglose como en Power BI: MO directa = cuenta Remuneraciones directas (cualquier tipo de gasto),
  // Materiales = alias MATERIALES dentro de gasto directo, MO indirecta = alias MANO DE OBRA INDIRECTA.
  const moDirecta = sum(c.gastos.filter((l) => l.ac === CUENTA_REMUN_DIRECTA), (l) => l.m);
  const materiales = sum(c.gastos.filter((l) => l.tg === TG_DIRECTO && l.al.toUpperCase() === "MATERIALES"), (l) => l.m);
  const moIndirecta = sum(c.gastos.filter((l) => l.al.toUpperCase() === "MANO DE OBRA INDIRECTA"), (l) => l.m);
  const embudo: { label: string; real: number; sub?: boolean; total?: boolean; gasto?: boolean }[] = [
    { label: "Ingreso", real: ventas },
    { label: "Gasto directo", real: directo, gasto: true },
    { label: "Gasto directo (MO directa)", real: moDirecta, sub: true, gasto: true },
    { label: "Gasto directo (Materiales)", real: materiales, sub: true, gasto: true },
    { label: "Resultado operacional", real: operacional, total: true },
    { label: "Gasto indirecto", real: indirecto, gasto: true },
    { label: "Gasto indirecto (MO indirecta)", real: moIndirecta, sub: true, gasto: true },
    { label: "Estado de resultado del área", real: estado, total: true },
    { label: "Gasto administrativo", real: admin, gasto: true },
    { label: "Estado de resultado empresa", real: empresa, total: true },
  ];
  const max = Math.max(...embudo.map((r) => Math.abs(r.real)), 1);

  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const detalle = useMemo(() => {
    const rows = [...c.ventas, ...c.gastos].sort((a, b) => (a.tg === b.tg ? b.d.localeCompare(a.d) : b.tg.localeCompare(a.tg)));
    return ql ? rows.filter((l) => `${l.tg} ${l.al} ${l.cn} ${l.dp} ${l.ic}`.toLowerCase().includes(ql)) : rows;
  }, [c.ventas, c.gastos, ql]);

  return (
    <>
      <div className="stats">
        <Kpi v={fmtCLP(ventas)} l="Ventas netas" color={C_VENTA} />
        <Kpi v={fmtCLP(operacional)} l="Resultado operacional" color={operacional >= 0 ? C_VENTA : C_GASTO} />
        <Kpi v={fmtCLP(estado)} l="Estado de resultado del área" color={estado >= 0 ? C_VENTA : C_GASTO} />
        <Kpi v={fmtPct(div(estado, ventas))} l="Margen del área sobre ventas" color={C_UTIL} />
      </div>
      <div className="rct-grid" style={{ gridTemplateColumns: "1fr 1.3fr" }}>
        <Panel title="Embudo de resultados reales" hint="De las ventas netas al estado de resultado de la empresa.">
          <div className="rct-hbars">
            {embudo.map((r) => {
              const pct = r.label === "Ingreso" ? "" : ` (${fmtPct(div(r.real, ventas))})`;
              return (
                <div className="rct-hbar" key={r.label} style={{ gridTemplateColumns: "minmax(150px, 34%) 1fr 175px" }} title={`${r.label}: ${fmtCLP(r.real)}${pct}`}>
                  <div className="lbl" style={r.sub ? { paddingLeft: 14, opacity: 0.85 } : undefined}>{r.label}</div>
                  <div className="track">
                    <div style={{ width: `${(Math.abs(r.real) / max) * 100}%`, background: r.gasto ? C_GASTO : r.real < 0 ? C_GASTO : C_VENTA, opacity: r.total ? 1 : 0.75 }} />
                  </div>
                  <div className="n">{fmtCLP(r.real)}{pct}</div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Real vs presupuesto" hint={c.hayPpto ? "Presupuesto del área para el período seleccionado." : "No hay presupuesto para el período o centro de negocio seleccionado."}>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th style={{ textAlign: "right" }}>Real</th>
                  <th style={{ textAlign: "right" }}>Presupuesto</th>
                  <th style={{ textAlign: "right" }}>Diferencia</th>
                  <th style={{ textAlign: "right" }}>% dif.</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => {
                  const d = r.real - r.ppto;
                  const sinP = !c.hayPpto;
                  return (
                    <tr key={r.label} className={r.total ? "eerr-total" : undefined}>
                      <td>{r.label}</td>
                      <td style={{ textAlign: "right" }}>{fmtCLP(r.real)}</td>
                      <td style={{ textAlign: "right" }}>{sinP ? "—" : fmtCLP(r.ppto)}</td>
                      <td style={{ textAlign: "right", color: sinP ? undefined : tone(d, false) }}>{sinP ? "—" : fmtCLP(d)}</td>
                      <td style={{ textAlign: "right", color: sinP ? undefined : tone(d, false) }}>{sinP ? "—" : fmtPct(div(d, Math.abs(r.ppto)))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <section className="summary">
        <h2>Detalle del estado de resultados</h2>
        <p className="hint">Cada línea contable con su tipo de gasto, alias de cuenta y centro de negocio. Las ventas aparecen sin tipo de gasto.</p>
        <input className="search-box" type="text" placeholder="Buscar por tipo de gasto, alias, centro de negocio, cuenta o comprobante…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="table-scroll" style={{ maxHeight: 460, overflowY: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo de gasto</th>
                <th style={{ textAlign: "right" }}>Monto</th>
                <th>Alias</th>
                <th>Centro de negocio</th>
                <th>Cuenta</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {detalle.slice(0, 300).map((l, i) => (
                <tr key={i}>
                  <td>{l.tg || "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmtCLP(l.m)}</td>
                  <td>{l.al || "—"}</td>
                  <td>{l.cn}</td>
                  <td className="wrap-col">{l.dp || l.ac}</td>
                  <td>{l.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          {detalle.length > 300 ? `Mostrando 300 de ${fmtNum(detalle.length)} líneas; usa el buscador para acotar. ` : `${fmtNum(detalle.length)} líneas. `}
          <strong>Total: </strong>
          {fmtCLP(sum(detalle, (l) => l.m))}
        </p>
      </section>
    </>
  );
}
