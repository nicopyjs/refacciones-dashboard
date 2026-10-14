"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LineRow, PptoRow, RctData } from "@/lib/rct/types";
import TopNav from "./TopNav";
import { Bullet, Gauge, HBars, SeriesChart, fmtCLP, fmtNum, fmtPct, labelYm } from "./RctCharts";
import "../app/dashboard.css";
import "../app/rct/rct.css";

const CN_INDIRECTOS = "RCTA - GENERAL REFACCION CENTRALES TERMICAS";
const MANO_OBRA = new Set(["MANO DE OBRA DIRECTA", "MANO DE OBRA G.A.F", "MANO DE OBRA HONORARIOS", "MANO DE OBRA INDIRECTA", "MANO DE OBRA"]);
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const C_VENTA = "#16a34a";
const C_GASTO = "#dc2626";
const C_UTIL = "#d97706";
const C_PRES = "#2563eb";

type Eco = "Con" | "Sin"; // con / sin provisiones
type Ctl = "year" | "month" | "cn" | "eco";
interface Filters { year: string; month: string; cn: string; eco: Eco }

const TABS: { id: string; label: string; ctl: Ctl[]; project?: boolean }[] = [
  { id: "ventas", label: "Ventas RCT", ctl: ["year", "month", "cn", "eco"] },
  { id: "directos", label: "Gastos Directos RCT", ctl: ["year", "month", "cn"] },
  { id: "indirectos", label: "Gastos Indirectos RCT", ctl: ["year", "month", "cn"] },
  { id: "utilidad", label: "Utilidad RCT", ctl: ["year", "month", "cn", "eco"] },
  { id: "resumen", label: "Resumen Económico RCT", ctl: ["year", "month", "cn", "eco"] },
  { id: "ventaHc", label: "Venta vs Hoja de Costo", ctl: ["year", "month", "cn", "eco"], project: true },
  { id: "gastoHc", label: "Gasto vs Hoja de Costo", ctl: ["year", "month", "cn"], project: true },
  { id: "resultado", label: "Resultado vs Hoja de Costo", ctl: ["year", "month", "cn", "eco"], project: true },
  { id: "mano", label: "Análisis de Gasto Mano de Obra", ctl: ["year", "month", "cn"], project: true },
  { id: "materiales", label: "Análisis de Gasto Materiales", ctl: ["year", "month", "cn"], project: true },
  { id: "avance", label: "% de Avance vs HC", ctl: ["year", "month", "cn", "eco"], project: true },
];

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
const div = (a: number, b: number): number | null => (b ? a / b : null);

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

function monthly(lines: LineRow[], months: string[], sign = 1): number[] {
  const acc = new Map<string, number>();
  for (const l of lines) acc.set(l.d.slice(0, 7), (acc.get(l.d.slice(0, 7)) ?? 0) + l.m);
  return months.map((m) => (acc.get(m) ?? 0) * sign);
}

function cumulative(v: number[]): number[] {
  let a = 0;
  return v.map((x) => (a += x));
}

function groupBy(lines: LineRow[], key: (l: LineRow) => string, sign = 1) {
  const m = new Map<string, number>();
  for (const l of lines) m.set(key(l), (m.get(key(l)) ?? 0) + l.m * sign);
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function normRut(s: string) {
  return s.replace(/[.\s]/g, "").toUpperCase();
}

/* ───────────── Presupuesto ───────────── */
interface Pres {
  ventaContrato: number;
  ventaAdicional: number;
  ventaTotal: number;
  gasto: number; // positivo
  mo: number; // positivo
  materiales: number; // positivo
  utilidad: number;
  porAlias: Map<string, number>; // gasto presupuestado positivo por alias
  hay: boolean;
}

function presupuesto(rows: PptoRow[], cnSet: Set<string>, cn: string): Pres {
  const sel = rows.filter((r) => cnSet.has(r.cn) && (cn === "all" || r.cn === cn));
  const ventaContrato = sum(sel.filter((r) => r.alias === "VENTA" && r.tipo === "CONTRATO"), (r) => r.importe);
  const ventaAdicional = sum(sel.filter((r) => r.alias === "VENTA" && r.tipo !== "CONTRATO"), (r) => r.importe);
  const porAlias = new Map<string, number>();
  for (const r of sel) if (r.alias !== "VENTA" && r.alias) porAlias.set(r.alias, (porAlias.get(r.alias) ?? 0) - r.importe);
  const gasto = sum([...porAlias.values()], (x) => x);
  const mo = sum([...porAlias.entries()].filter(([a]) => MANO_OBRA.has(a)), ([, v]) => v);
  const ventaTotal = ventaContrato + ventaAdicional;
  return { ventaContrato, ventaAdicional, ventaTotal, gasto, mo, materiales: gasto - mo, utilidad: ventaTotal - gasto, porAlias, hay: sel.length > 0 };
}

/* ───────────── UI base ───────────── */
function Kpi({ v, l, tone, big }: { v: string; l: string; tone?: "good" | "bad" | "warn"; big?: boolean }) {
  const color = tone === "good" ? "var(--status-good)" : tone === "bad" ? "var(--status-critical)" : tone === "warn" ? "var(--status-warning)" : undefined;
  return (
    <div className={`stat-tile${big ? " rct-kpi-big" : ""}`}>
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

const money = (n: number | null) => (n === null ? "—" : fmtCLP(n));
const pctTone = (p: number | null, invert = false): "good" | "bad" | "warn" | undefined => {
  if (p === null) return undefined;
  if (invert) return p > 1 ? "bad" : p >= 0.85 ? "warn" : "good"; // gasto: pasarse es malo
  return p >= 1 ? "good" : p >= 0.5 ? "warn" : undefined;
};

interface Col { h: string; get: (l: LineRow) => string; right?: boolean; wrap?: boolean }

function LinesTable({ title, hint, rows, cols, totals }: { title: string; hint?: string; rows: LineRow[]; cols: Col[]; totals: { label: string; f: (l: LineRow) => number }[] }) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const shown = ql ? rows.filter((l) => `${l.cn} ${l.cd} ${l.c1} ${l.c2} ${l.cm} ${l.al}`.toLowerCase().includes(ql)) : rows;
  return (
    <section className="summary">
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      <input className="search-box" type="text" placeholder="Buscar en centro de negocio, glosa, clasificadores o cuenta…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="table-scroll" style={{ maxHeight: 460, overflowY: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>{cols.map((c) => <th key={c.h} style={c.right ? { textAlign: "right" } : undefined}>{c.h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.slice(0, 300).map((l, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.h} className={c.wrap ? "wrap-col" : undefined} style={c.right ? { textAlign: "right" } : undefined}>{c.get(l) || "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        {shown.length > 300 ? `Mostrando 300 de ${fmtNum(shown.length)} líneas; usa el buscador para acotar. ` : `${fmtNum(shown.length)} líneas. `}
        <strong>Total: </strong>
        {totals.map((t) => `${t.label} ${fmtCLP(sum(shown, t.f))}`).join(" · ")}
      </p>
    </section>
  );
}

const C = {
  cn: { h: "Centro de negocio", get: (l: LineRow) => l.cn },
  cd: { h: "Descripción CN", get: (l: LineRow) => l.cd },
  fecha: { h: "Fecha", get: (l: LineRow) => l.d },
  c1: { h: "Clasificador 1", get: (l: LineRow) => l.c1 },
  c2: { h: "Clasificador 2", get: (l: LineRow) => l.c2 },
  desc: { h: "Descripción", get: (l: LineRow) => l.cm, wrap: true },
  cuenta: { h: "Cuenta", get: (l: LineRow) => l.al },
};

/* ───────────── Contexto filtrado ───────────── */
interface Ctx {
  data: RctData;
  f: Filters;
  all: LineRow[]; // todas las líneas del filtro
  ventas: LineRow[];
  gastos: LineRow[];
  months: string[];
  cnSet: Set<string>;
  pres: Pres;
  proyecto: string;
}

function monthsOf(lines: LineRow[], f: Filters): string[] {
  const ym = lines.map((l) => l.d.slice(0, 7));
  if (f.year !== "all" && f.month === "all") {
    const r = monthRange(ym);
    return r.length ? r : [];
  }
  return monthRange(ym);
}

/* ───────────── Componente principal ───────────── */
export default function RctDashboard({ data, error, generatedAt, stale }: { data: RctData | null; error: string | null; generatedAt: string; stale: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState(TABS[0].id);

  const years = useMemo(() => (data ? [...new Set(data.lines.map((l) => l.d.slice(0, 4)))].sort().reverse() : []), [data]);
  const cns = useMemo(() => (data ? [...new Set(data.lines.map((l) => l.cn))].sort() : []), [data]);
  const [f, setF] = useState<Filters>({ year: "", month: "all", cn: "all", eco: "Con" });
  const year = f.year || years[0] || "all";
  const ff: Filters = { ...f, year };

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const ctx = useMemo<Ctx | null>(() => {
    if (!data) return null;
    const cnSet = new Set(data.cnList);
    const all = data.lines.filter(
      (l) =>
        (ff.year === "all" || l.d.startsWith(ff.year)) &&
        (ff.month === "all" || l.d.slice(5, 7) === ff.month) &&
        (ff.cn === "all" || l.cn === ff.cn) &&
        !(ff.eco === "Sin" && l.t === "V" && l.x)
    );
    return {
      data,
      f: ff,
      all,
      ventas: all.filter((l) => l.t === "V"),
      gastos: all.filter((l) => l.t === "G"),
      months: monthsOf(all, ff),
      cnSet,
      pres: presupuesto(data.ppto, cnSet, ff.cn),
      proyecto: ff.cn === "all" ? "Todos los centros de negocio" : ff.cn,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ff.year, ff.month, ff.cn, ff.eco]);

  const head = (
    <>
      <TopNav active="rct" />
      <header className="page-head">
        <h1>Venta y Gastos RCT</h1>
        <p className="sub">Réplica del tablero de Power BI, alimentada en vivo desde los Sheets contables y de presupuestos</p>
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

  const cur = TABS.find((t) => t.id === tab) ?? TABS[0];
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
          {cur.ctl.includes("year") && (
            <label>
              <span>Año de análisis</span>
              <select value={ff.year} onChange={(e) => set({ year: e.target.value })}>
                <option value="all">Todos</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          )}
          {cur.ctl.includes("month") && (
            <label>
              <span>Mes</span>
              <select value={ff.month} onChange={(e) => set({ month: e.target.value })}>
                <option value="all">Todos</option>
                {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
              </select>
            </label>
          )}
          {cur.ctl.includes("cn") && (
            <label className="wide">
              <span>{cur.project ? "Proyecto" : "Centro de negocio"}</span>
              <select value={ff.cn} onChange={(e) => set({ cn: e.target.value })}>
                <option value="all">Todas</option>
                {cns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          {cur.ctl.includes("eco") && (
            <div className="seg" role="group" aria-label="Provisiones">
              <span>Provisiones</span>
              <div>
                {(["Con", "Sin"] as Eco[]).map((e) => (
                  <button key={e} className={ff.eco === e ? "on" : ""} onClick={() => set({ eco: e })}>{e === "Sin" ? "Sin provisiones" : "Con provisiones"}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {tab === "ventas" && <Ventas c={ctx} />}
        {tab === "directos" && <Gastos c={ctx} indirectos={false} />}
        {tab === "indirectos" && <Gastos c={ctx} indirectos />}
        {tab === "utilidad" && <Utilidad c={ctx} />}
        {tab === "resumen" && <Resumen c={ctx} />}
        {tab === "ventaHc" && <VentaHc c={ctx} />}
        {tab === "gastoHc" && <GastoHc c={ctx} />}
        {tab === "resultado" && <Resultado c={ctx} />}
        {tab === "mano" && <ManoObra c={ctx} />}
        {tab === "materiales" && <Materiales c={ctx} />}
        {tab === "avance" && <Avance c={ctx} />}

        <footer className="note">
          <strong>Sobre esta página:</strong> venta = cuentas 3.x y gasto = cuentas 4.x de los centros de negocio RCT, leídas de los Sheets contables
          (2021–2026). «Sin provisiones» omite la cuenta de provisión 3110101002; «Con provisiones» la incluye. El presupuesto sale de la hoja de costo (PPTOS) y no depende
          del año ni del mes. Los montos de 2024–2026 coinciden con Power BI.
        </footer>
      </div>
    </div>
  );
}

/* ───────────── 1. Ventas RCT ───────────── */
function Ventas({ c }: { c: Ctx }) {
  const mensual = monthly(c.ventas, c.months);
  const real = sum(mensual, (x) => x);
  const pres = c.pres.hay ? c.pres.ventaTotal : null;
  const labels = c.months.map(labelYm);
  return (
    <>
      <div className="stats">
        <Kpi v={money(pres)} l="Venta presupuestada" />
        <Kpi v={fmtCLP(real)} l="Ventas reales" tone="good" />
        <Kpi v={pres === null ? "—" : fmtCLP(pres - real)} l="Diferencia (presupuestada − real)" />
        <Kpi v={fmtPct(pres ? real / pres : null)} l="% de avance" tone={pctTone(pres ? real / pres : null)} />
      </div>
      <div className="rct-grid">
        <Panel title="Ventas presupuestadas vs reales" hint="Venta real acumulada y mensual frente a la venta presupuestada de la hoja de costo.">
          <SeriesChart
            labels={labels}
            series={[
              { name: "Ventas reales acumuladas", kind: "area", values: cumulative(mensual), color: C_VENTA },
              ...(pres ? [{ name: "Venta presupuestada", kind: "line" as const, values: c.months.map(() => pres), color: C_UTIL, dashed: true }] : []),
            ]}
          />
        </Panel>
        <Panel title="Ventas por mes">
          <SeriesChart labels={labels} series={[{ name: "Ventas reales", kind: "bar", values: mensual, color: C_VENTA }]} />
        </Panel>
      </div>
      <div className="rct-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <LinesTable
          title="Detalles facturación DF"
          hint="Líneas de venta contable del período, más recientes primero."
          rows={c.ventas}
          cols={[C.cn, C.fecha, C.c1, C.c2, C.desc, { h: "Monto venta", get: (l) => fmtCLP(l.m), right: true }]}
          totals={[{ label: "Ventas", f: (l) => l.m }]}
        />
        <Panel title="Monto de ventas por CN" hint="Top 14 centros de negocio.">
          <HBars items={groupBy(c.ventas, (l) => l.cn).slice(0, 14)} color={C_VENTA} />
        </Panel>
      </div>
    </>
  );
}

/* ───────────── 2 y 3. Gastos Directos / Indirectos ───────────── */
function Gastos({ c, indirectos }: { c: Ctx; indirectos: boolean }) {
  const rows = c.gastos.filter((l) => (l.cn === CN_INDIRECTOS) === indirectos);
  const mensual = monthly(rows, c.months, -1);
  const real = sum(mensual, (x) => x);
  const pres = !indirectos && c.pres.hay ? c.pres.gasto : null;
  const labels = c.months.map(labelYm);
  return (
    <>
      <div className="stats">
        <Kpi v={money(pres)} l="Gastos presupuestados" />
        <Kpi v={fmtCLP(real)} l="Gasto real" tone="bad" />
        <Kpi v={pres === null ? "—" : fmtCLP(pres - real)} l="Diferencia (presupuestado − real)" />
        <Kpi v={fmtPct(pres ? real / pres : null)} l="% de avance" tone={pctTone(pres ? real / pres : null, true)} />
      </div>
      <div className="rct-grid">
        <Panel title="Gastos reales acumulados" hint={indirectos ? "Centro «General Refacción Centrales Térmicas»." : "Todos los centros de negocio RCT salvo el de gastos indirectos."}>
          <SeriesChart
            labels={labels}
            series={[
              { name: "Gastos reales acumulados", kind: "area", values: cumulative(mensual), color: C_GASTO },
              ...(pres ? [{ name: "Gasto presupuestado", kind: "line" as const, values: c.months.map(() => pres), color: C_UTIL, dashed: true }] : []),
            ]}
          />
        </Panel>
        <Panel title="Gastos por mes">
          <SeriesChart labels={labels} series={[{ name: "Gasto real", kind: "bar", values: mensual, color: C_GASTO }]} />
        </Panel>
      </div>
      <div className="rct-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <LinesTable
          title="Detalles facturación DF"
          hint="Líneas de gasto contable del período, más recientes primero."
          rows={rows}
          cols={[C.cd, C.fecha, C.c1, C.c2, C.desc, { h: "Monto gasto", get: (l) => fmtCLP(l.m), right: true }, C.cuenta]}
          totals={[{ label: "Gasto", f: (l) => -l.m }]}
        />
        <Panel title="Monto de gastos por CN" hint="Top 14 centros de negocio.">
          <HBars items={groupBy(rows, (l) => l.cn, -1).slice(0, 14)} color={C_GASTO} />
        </Panel>
      </div>
    </>
  );
}

/* ───────────── 4. Utilidad RCT ───────────── */
function Utilidad({ c }: { c: Ctx }) {
  const venta = monthly(c.ventas, c.months);
  const gasto = monthly(c.gastos, c.months, -1);
  const util = venta.map((v, i) => v - gasto[i]);
  const real = sum(util, (x) => x);
  const pres = c.pres.hay ? c.pres.utilidad : null;
  const labels = c.months.map(labelYm);
  return (
    <>
      <div className="stats">
        <Kpi v={money(pres)} l="Utilidad presupuestada" />
        <Kpi v={fmtCLP(real)} l="Utilidad real" tone={real >= 0 ? "good" : "bad"} />
        <Kpi v={pres === null ? "—" : fmtCLP(pres - real)} l="Diferencia (presupuestada − real)" />
        <Kpi v={fmtPct(pres ? real / pres : null)} l="% de avance" tone={pctTone(pres ? real / pres : null)} />
      </div>
      <div className="rct-grid">
        <Panel title="Utilidad presupuestada vs real" hint="Utilidad acumulada frente a la utilidad presupuestada (venta − gasto de la hoja de costo).">
          <SeriesChart
            labels={labels}
            series={[
              { name: "Utilidad real acumulada", kind: "area", values: cumulative(util), color: C_VENTA },
              ...(pres ? [{ name: "Utilidad presupuestada", kind: "line" as const, values: c.months.map(() => pres), color: C_UTIL, dashed: true }] : []),
            ]}
          />
        </Panel>
        <Panel title="Utilidad por mes">
          <SeriesChart labels={labels} series={[{ name: "Utilidad real", kind: "bar", values: util, color: C_UTIL }]} />
        </Panel>
      </div>
      <div className="rct-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <LinesTable
          title="Detalles facturación DF"
          hint="Todas las líneas de venta y gasto del período; la utilidad es el monto con su signo."
          rows={c.all}
          cols={[C.cn, C.fecha, C.c1, C.c2, C.desc, { h: "Utilidad", get: (l) => fmtCLP(l.m), right: true }]}
          totals={[{ label: "Utilidad", f: (l) => l.m }]}
        />
        <Panel title="Utilidad por CN" hint="Top 14 centros de negocio.">
          <HBars items={groupBy(c.all, (l) => l.cn).slice(0, 14)} color={C_UTIL} />
        </Panel>
      </div>
    </>
  );
}

/* ───────────── 5. Resumen Económico ───────────── */
function Resumen({ c }: { c: Ctx }) {
  const venta = monthly(c.ventas, c.months);
  const gasto = monthly(c.gastos, c.months);
  const util = venta.map((v, i) => v + gasto[i]);
  const tv = sum(venta, (x) => x);
  const tg = sum(gasto, (x) => x);
  return (
    <>
      <div className="stats">
        <Kpi v={fmtCLP(tv)} l="Ventas RCT" tone="good" />
        <Kpi v={fmtCLP(tg)} l="Gasto RCT" tone="bad" />
        <Kpi v={fmtCLP(tv + tg)} l="Utilidad RCT" tone={tv + tg >= 0 ? "good" : "bad"} />
      </div>
      <div className="rct-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <Panel title="Venta, costo y utilidad RCT" hint="Resultado mensual: ganancia, gasto y utilidad.">
          <SeriesChart
            labels={c.months.map(labelYm)}
            series={[
              { name: "Utilidad", kind: "bar", values: util, color: C_UTIL },
              { name: "Ganancia", kind: "bar", values: venta, color: C_VENTA },
              { name: "Gasto", kind: "bar", values: gasto, color: C_GASTO },
            ]}
          />
        </Panel>
        <Panel title="Monto de ventas por CN" hint="Top 14 centros de negocio.">
          <HBars items={groupBy(c.ventas, (l) => l.cn).slice(0, 14)} color={C_VENTA} />
        </Panel>
      </div>
      <LinesTable
        title="Detalles facturación DF"
        rows={c.all}
        cols={[C.cn, C.fecha, C.c1, C.c2, C.desc, { h: "Monto venta", get: (l) => (l.t === "V" ? fmtCLP(l.m) : ""), right: true }, { h: "Monto gasto", get: (l) => (l.t === "G" ? fmtCLP(l.m) : ""), right: true }]}
        totals={[{ label: "Ventas", f: (l) => (l.t === "V" ? l.m : 0) }, { label: "Gasto", f: (l) => (l.t === "G" ? l.m : 0) }]}
      />
    </>
  );
}

/* ───────────── 6. Venta vs Hoja de Costo ───────────── */
function VentaHc({ c }: { c: Ctx }) {
  const mensual = monthly(c.ventas, c.months);
  const real = sum(mensual, (x) => x);
  const p = c.pres;
  const meses = new Set(c.ventas.map((l) => l.d.slice(0, 7))).size;
  const labels = c.months.map(labelYm);
  return (
    <>
      <h2 className="rct-title">{c.proyecto}</h2>
      <div className="stats">
        <Kpi v={money(p.hay ? p.ventaContrato : null)} l="Venta presupuestada" />
        <Kpi v={p.hay && p.ventaAdicional ? fmtCLP(p.ventaAdicional) : "—"} l="Venta adicional presupuestada" />
        <Kpi v={money(p.hay ? p.ventaTotal : null)} l="Venta presupuestada (contrato + adicional)" />
        <Kpi v={fmtCLP(real)} l="Ventas reales" tone="good" />
        <Kpi v={p.hay ? fmtCLP(p.ventaTotal - real) : "—"} l="Saldo del proyecto (diferencia)" />
        <Kpi v={String(meses)} l="Meses con actividad" />
        <Kpi v={fmtPct(p.hay ? div(real, p.ventaTotal) : null)} l="% de avance" tone={pctTone(p.hay ? div(real, p.ventaTotal) : null)} />
      </div>
      <div className="rct-grid">
        <Panel title="Ventas acumuladas vs venta presupuestada" hint="Ventas acumuladas, venta presupuestada de contrato y de contrato más adicional.">
          <SeriesChart
            labels={labels}
            series={[
              { name: "Ventas acumuladas", kind: "area", values: cumulative(mensual), color: C_PRES },
              ...(p.hay
                ? [
                    { name: "Venta presupuestada contrato", kind: "line" as const, values: c.months.map(() => p.ventaContrato), color: C_VENTA, dashed: true },
                    { name: "Contrato + adicional", kind: "line" as const, values: c.months.map(() => p.ventaTotal), color: C_UTIL, dashed: true },
                  ]
                : []),
            ]}
          />
        </Panel>
        <Panel title="Ventas por mes">
          <SeriesChart labels={labels} series={[{ name: "Monto ventas", kind: "bar", values: mensual, color: C_UTIL }]} />
        </Panel>
      </div>
    </>
  );
}

/* ───────────── 7. Gasto vs Hoja de Costo ───────────── */
function GastoHc({ c }: { c: Ctx }) {
  const mensual = monthly(c.gastos, c.months, -1);
  const real = sum(mensual, (x) => x);
  const p = c.pres;
  const meses = new Set(c.gastos.map((l) => l.d.slice(0, 7))).size;
  const labels = c.months.map(labelYm);
  return (
    <>
      <h2 className="rct-title">{c.proyecto}</h2>
      <div className="stats">
        <Kpi v={money(p.hay ? p.gasto : null)} l="Gasto presupuestado" />
        <Kpi v={fmtCLP(real)} l="Gasto real del proyecto" tone="bad" />
        <Kpi v={p.hay ? fmtCLP(p.gasto - real) : "—"} l="Saldo del proyecto" />
        <Kpi v={String(meses)} l="Meses con actividad" />
        <Kpi v={fmtPct(p.hay ? div(real, p.gasto) : null)} l="% de avance" tone={pctTone(p.hay ? div(real, p.gasto) : null, true)} />
        <Kpi v={meses ? fmtCLP(real / meses) : "—"} l="Gasto promedio mensual" />
        <Kpi v={p.hay && meses ? fmtCLP(p.gasto / meses) : "—"} l="Gasto promedio mensual presupuestado" />
      </div>
      <div className="rct-grid">
        <Panel title="Gasto acumulado vs gasto presupuestado">
          <SeriesChart
            labels={labels}
            series={[
              { name: "Gasto acumulado", kind: "area", values: cumulative(mensual), color: C_GASTO },
              ...(p.hay ? [{ name: "Gasto presupuestado", kind: "line" as const, values: c.months.map(() => p.gasto), color: C_UTIL, dashed: true }] : []),
            ]}
          />
        </Panel>
        <Panel title="Gasto por mes">
          <SeriesChart labels={labels} series={[{ name: "Monto gasto", kind: "bar", values: mensual, color: C_UTIL }]} />
        </Panel>
      </div>
    </>
  );
}

/* ───────────── 8. Resultado vs Hoja de Costo ───────────── */
function Resultado({ c }: { c: Ctx }) {
  const venta = monthly(c.ventas, c.months);
  const gasto = monthly(c.gastos, c.months, -1);
  const tv = sum(venta, (x) => x);
  const tg = sum(gasto, (x) => x);
  const ut = tv - tg;
  const p = c.pres;
  const hay = p.hay;
  const labels = c.months.map(labelYm);
  const margenP = hay ? div(p.ventaTotal - p.gasto, p.ventaTotal) : null;
  return (
    <>
      <h2 className="rct-title">{c.proyecto}</h2>
      <div className="stats">
        <Kpi v={money(hay ? p.ventaTotal : null)} l="Venta presupuestada total" />
        <Kpi v={fmtCLP(tv)} l="Ventas reales" tone="good" />
        <Kpi v={hay ? fmtCLP(p.ventaTotal - tv) : "—"} l="Diferencia ventas" />
        <Kpi v={fmtPct(hay ? div(tv, p.ventaTotal) : null)} l="% de avance ventas" />
        <Kpi v={money(hay ? p.utilidad : null)} l="Utilidad presupuestada" />
      </div>
      <div className="stats">
        <Kpi v={money(hay ? p.gasto : null)} l="Gasto presupuestado" />
        <Kpi v={fmtCLP(tg)} l="Gasto real" tone="bad" />
        <Kpi v={hay ? fmtCLP(p.gasto - tg) : "—"} l="Diferencia gasto" />
        <Kpi v={fmtPct(hay ? div(tg, p.gasto) : null)} l="% de avance gasto" tone={pctTone(hay ? div(tg, p.gasto) : null, true)} />
        <Kpi v={fmtCLP(ut)} l="Utilidad real" tone={ut >= 0 ? "good" : "bad"} />
      </div>
      <div className="stats">
        <Kpi v={fmtPct(margenP)} l="Margen presupuestado" />
        <Kpi v={fmtPct(div(ut, tv))} l="Margen real" />
        <Kpi v={hay ? fmtCLP(ut - p.utilidad) : "—"} l="Diferencia utilidad" tone={hay && ut - p.utilidad < 0 ? "bad" : undefined} />
        <Kpi v={fmtPct(hay ? div(ut, p.utilidad) : null)} l="% de avance utilidad" />
        <Kpi v={hay && p.gasto ? fmtNum(p.ventaTotal / p.gasto, 2) : "—"} l="Factor presupuestado" />
        <Kpi v={tg ? fmtNum(tv / tg, 2) : "—"} l="Factor real" />
      </div>
      <Panel title="Utilidad, gasto y ventas acumulados" hint="Acumulados reales (líneas llenas) y presupuestados (líneas punteadas).">
        <SeriesChart
          height={300}
          labels={labels}
          series={[
            { name: "Ventas acumuladas", kind: "line", values: cumulative(venta), color: C_VENTA },
            { name: "Gasto acumulado", kind: "line", values: cumulative(gasto), color: C_GASTO },
            { name: "Utilidad acumulada", kind: "line", values: cumulative(venta.map((v, i) => v - gasto[i])), color: C_UTIL },
            ...(hay
              ? [
                  { name: "Venta presupuestada", kind: "line" as const, values: c.months.map(() => p.ventaTotal), color: C_VENTA, dashed: true },
                  { name: "Gasto presupuestado", kind: "line" as const, values: c.months.map(() => p.gasto), color: C_GASTO, dashed: true },
                  { name: "Utilidad presupuestada", kind: "line" as const, values: c.months.map(() => p.utilidad), color: C_UTIL, dashed: true },
                ]
              : []),
          ]}
        />
      </Panel>
    </>
  );
}

/* ───────────── 9. Mano de Obra ───────────── */
function ManoObra({ c }: { c: Ctx }) {
  const nombres = useMemo(() => new Map(c.data.empleados.map(([rut, n]) => [normRut(rut), n])), [c.data.empleados]);
  const rows = c.gastos.filter((l) => MANO_OBRA.has(l.al));
  const mensual = monthly(rows, c.months, -1);
  const real = sum(mensual, (x) => x);
  const pres = c.pres.hay ? c.pres.mo : null;
  const meses = new Set(rows.map((l) => l.d.slice(0, 7))).size;
  const porPersona = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of rows) {
      if (!l.cm.startsWith("Dist Remu -")) continue;
      const rut = normRut(l.cm.slice("Dist Remu -".length));
      const nombre = nombres.get(rut) ?? `RUT ${l.cm.slice("Dist Remu -".length).trim()}`;
      m.set(nombre, (m.get(nombre) ?? 0) - l.m);
    }
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 16);
  }, [rows, nombres]);
  return (
    <>
      <h2 className="rct-title">{c.proyecto}</h2>
      <div className="stats">
        <Kpi v={money(pres)} l="Mano de obra presupuestada" />
        <Kpi v={fmtCLP(real)} l="Mano de obra real" tone="bad" />
        <Kpi v={pres === null ? "—" : fmtCLP(pres - real)} l="Saldo mano de obra" />
        <Kpi v={fmtPct(pres ? real / pres : null)} l="% de avance mano de obra" tone={pctTone(pres ? real / pres : null, true)} />
        <Kpi v={pres === null ? "—" : fmtNum(pres / 1e6, 2)} l="Presupuestado (millones)" />
        <Kpi v={fmtNum(real / 1e6, 2)} l="Gastado (millones)" />
        <Kpi v={String(meses)} l="Meses con actividad" />
      </div>
      <div className="rct-grid">
        <Panel title="Gasto de mano de obra por persona" hint="Según la distribución de remuneraciones («Dist Remu»), cruzada con el maestro de empleados.">
          <HBars items={porPersona} color={C_GASTO} />
        </Panel>
        <Panel title="Gasto de mano de obra por mes">
          <SeriesChart labels={c.months.map(labelYm)} series={[{ name: "Mano de obra", kind: "bar", values: mensual, color: C_GASTO }]} />
        </Panel>
      </div>
    </>
  );
}

/* ───────────── 10. Materiales ───────────── */
function Materiales({ c }: { c: Ctx }) {
  const rows = c.gastos.filter((l) => !MANO_OBRA.has(l.al) && l.al !== "VENTAS");
  const real = new Map<string, number>();
  for (const l of rows) real.set(l.al, (real.get(l.al) ?? 0) - l.m);
  const names = new Set([...real.keys(), ...[...c.pres.porAlias.keys()].filter((a) => !MANO_OBRA.has(a))]);
  const filas = [...names]
    .map((a) => {
      const pp = c.pres.porAlias.get(a) ?? 0;
      const rr = real.get(a) ?? 0;
      return { alias: a, pres: pp, real: rr, dif: pp - rr, pct: pp ? rr / pp : null };
    })
    .filter((f) => f.pres || f.real)
    .sort((a, b) => b.pres - a.pres || b.real - a.real);
  const tp = sum(filas, (f) => f.pres);
  const tr = sum(filas, (f) => f.real);
  const graf = filas.filter((f) => f.pres > 0).slice(0, 12);
  return (
    <>
      <h2 className="rct-title">{c.proyecto}</h2>
      <div className="stats">
        <Kpi v={money(c.pres.hay ? tp : null)} l="Gasto presupuestado" />
        <Kpi v={fmtCLP(tr)} l="Gasto real" tone="bad" />
        <Kpi v={c.pres.hay ? fmtCLP(tp - tr) : "—"} l="Diferencia" />
        <Kpi v={fmtPct(div(tr, tp))} l="Porcentaje de avance" tone={pctTone(div(tr, tp), true)} />
      </div>
      <Panel title="Gasto presupuestado y real por tipo de gasto" hint="Sin mano de obra. Solo tipos con presupuesto.">
        <SeriesChart
          height={300}
          labels={graf.map((f) => f.alias)}
          series={[
            { name: "Gasto presupuestado", kind: "bar", values: graf.map((f) => f.pres), color: "#d6b100" },
            { name: "Gasto real", kind: "bar", values: graf.map((f) => f.real), color: C_GASTO },
          ]}
        />
      </Panel>
      <section className="summary">
        <h2>Detalles de gastos por proyecto</h2>
        <p className="hint">Diferencia = presupuestado − real (negativo: sobre el presupuesto).</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Tipo de gasto</th><th style={{ textAlign: "right" }}>Gasto presupuestado</th><th style={{ textAlign: "right" }}>Gasto real</th><th style={{ textAlign: "right" }}>Diferencia</th><th>%</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.alias}>
                  <td className="obra-col">{f.alias}</td>
                  <td style={{ textAlign: "right" }}>{f.pres ? fmtCLP(f.pres) : "—"}</td>
                  <td style={{ textAlign: "right" }}>{f.real ? fmtCLP(f.real) : "—"}</td>
                  <td style={{ textAlign: "right", color: f.dif < 0 ? "var(--status-critical)" : undefined }}>{fmtCLP(f.dif)}</td>
                  <td>{f.pct === null ? "—" : fmtPct(f.pct)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td style={{ textAlign: "right" }}>{fmtCLP(tp)}</td>
                <td style={{ textAlign: "right" }}>{fmtCLP(tr)}</td>
                <td style={{ textAlign: "right" }}>{fmtCLP(tp - tr)}</td>
                <td>{fmtPct(div(tr, tp))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ───────────── 11. % de Avance vs HC ───────────── */
function Avance({ c }: { c: Ctx }) {
  const tv = sum(c.ventas, (l) => l.m);
  const tg = -sum(c.gastos, (l) => l.m);
  const mo = -sum(c.gastos.filter((l) => MANO_OBRA.has(l.al)), (l) => l.m);
  const mat = tg - mo;
  const ut = tv - tg;
  const p = c.pres;
  const items = [
    { t: "Porcentaje de avance ventas", real: tv, pres: p.ventaTotal, color: C_VENTA, invert: false },
    { t: "Porcentaje de avance gastos", real: tg, pres: p.gasto, color: C_GASTO, invert: true },
    { t: "Porcentaje de avance utilidad", real: ut, pres: p.utilidad, color: C_UTIL, invert: false },
    { t: "% de avance gasto mano de obra", real: mo, pres: p.mo, color: C_GASTO, invert: true },
    { t: "% de avance gasto materiales", real: mat, pres: p.materiales, color: C_GASTO, invert: true },
  ];
  return (
    <>
      <h2 className="rct-title">{c.proyecto}</h2>
      {!p.hay && <div className="rct-note">No hay hoja de costo para este filtro: los medidores quedan en blanco.</div>}
      <div className="rct-avance">
        {items.map((it) => {
          const pct = p.hay ? div(it.real, it.pres) : null;
          return (
            <section className="summary" key={it.t} style={{ marginTop: 0 }}>
              <h2>{it.t}</h2>
              <div className="rct-avance-row">
                <Gauge pct={pct} color={it.color} label={`${fmtCLP(it.real)} de ${p.hay ? fmtCLP(it.pres) : "—"}`} left="0%" right="100%" />
                <Bullet value={it.real} target={it.pres} color={it.color} label="Real vs presupuestado" />
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
