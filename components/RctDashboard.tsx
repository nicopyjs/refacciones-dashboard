"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RctData, GlRow } from "@/lib/rct/types";
import TopNav from "./TopNav";
import { HBars, Pie, SeriesChart, Stacked100, fmtCLP, fmtCompact, fmtNum, fmtPct, labelYm, type Series } from "./RctCharts";
import "../app/dashboard.css";
import "../app/rct/rct.css";

const CN_INDIRECTOS = "RCTA - GENERAL REFACCION CENTRALES TERMICAS";
const MANO_OBRA = new Set(["MANO DE OBRA DIRECTA", "MANO DE OBRA G.A.F", "MANO DE OBRA HONORARIOS", "MANO DE OBRA INDIRECTA", "MANO DE OBRA"]);

const TABS = [
  { id: "indirectos", label: "Gastos Indirectos RCT" },
  { id: "ventaInta", label: "Venta vs Hoja de Costo (INTA)" },
  { id: "materiales", label: "Análisis de Gasto Materiales" },
  { id: "adicionales", label: "Análisis PPTOS adicionales" },
  { id: "avance", label: "Avance operativo" },
  { id: "ventaRct", label: "Venta vs Hoja de Costo" },
  { id: "gastoRct", label: "Gasto vs Hoja de Costo" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);

/** Meses consecutivos entre el primero y el último (para que el eje X no tenga saltos). */
function monthRange(yms: string[]): string[] {
  if (yms.length === 0) return [];
  const sorted = [...yms].sort();
  const [y0, m0] = sorted[0].split("-").map(Number);
  const [y1, m1] = sorted[sorted.length - 1].split("-").map(Number);
  const out: string[] = [];
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m++) {
    if (m > 12) { m = 1; y++; }
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (y === y1 && m === m1) break;
  }
  return out;
}

function byMonth(rows: GlRow[], months: string[], sign = 1): number[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.ym, (m.get(r.ym) ?? 0) + r.monto);
  return months.map((k) => (m.get(k) ?? 0) * sign);
}

function cumulative(v: number[]): number[] {
  let acc = 0;
  return v.map((x) => (acc += x));
}

function Tile({ v, l, color }: { v: string; l: string; color?: string }) {
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

function pctColor(p: number | null) {
  if (p === null) return undefined;
  return p > 1 ? "var(--status-critical)" : p >= 0.85 ? "var(--status-warning)" : "var(--status-good)";
}

export default function RctDashboard({ data, error, generatedAt, stale }: { data: RctData | null; error: string | null; generatedAt: string; stale: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("indirectos");

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const head = (
    <>
      <TopNav active="rct" />
      <header className="page-head">
        <h1>Venta y Gastos RCT</h1>
        <p className="sub">Réplica del tablero de Power BI, alimentada en vivo desde los Sheets contables y de presupuestos</p>
        <div className="meta">
          {data && (
            <>
              <span>Movimientos hasta <strong style={{ color: "var(--text-secondary)" }}>{data.ledgerLastDate}</strong> · {fmtNum(data.ledgerRows)} líneas contables</span>
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

  if (error || !data) {
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
        {tab === "indirectos" && <Indirectos data={data} />}
        {tab === "ventaInta" && <VentaHc data={data} area="INTA" titulo="INTA (Instalaciones)" />}
        {tab === "materiales" && <Materiales data={data} />}
        {tab === "adicionales" && <Adicionales data={data} />}
        {tab === "avance" && <Avance data={data} />}
        {tab === "ventaRct" && <VentaHc data={data} area="RCT" titulo="RCT (Refacciones)" />}
        {tab === "gastoRct" && <GastoHc data={data} />}
        <footer className="note">
          <strong>Sobre esta página:</strong> los datos se leen de los Google Sheets contables (movimientos 2021–2026), el plan de cuentas, los centros de
          negocio, la hoja de costo (PPTOS) y los adicionales de obra. Los montos coinciden con Power BI para 2024–2026; los años 2021–2023 existen
          solo aquí. Gasto = cuentas 4.x, venta = cuentas 3.x; área RCT por centro de negocio que parte en «RCT», INTA por «INT».
        </footer>
      </div>
    </div>
  );
}

/* ───────────── 1. Gastos Indirectos RCT ───────────── */
function Indirectos({ data }: { data: RctData }) {
  const [q, setQ] = useState("");
  const rowsCn = useMemo(() => data.gl.filter((r) => r.area === "RCT" && r.tipo === "Gasto" && r.cn === CN_INDIRECTOS), [data]);
  const ppto = useMemo(() => data.pptoGastos.filter((r) => r.area === "Refacciones"), [data]);
  const months = useMemo(() => monthRange([...rowsCn.map((r) => r.ym), ...ppto.map((r) => r.ym)]), [rowsCn, ppto]);
  const real = byMonth(rowsCn, months, -1);
  const presMap = new Map(ppto.map((r) => [r.ym, r.monto]));
  const pres = months.map((m) => presMap.get(m) ?? 0);
  const totalReal = sum(real, (x) => x);
  const totalPres = sum(pres, (x) => x);

  const porCn = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.gl) if (r.area === "RCT" && r.tipo === "Gasto") m.set(r.cn, (m.get(r.cn) ?? 0) - r.monto);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 14);
  }, [data]);

  const ql = q.trim().toLowerCase();
  const detalle = ql ? data.detalleIndirectos.filter((d) => `${d.comment} ${d.c1} ${d.c2} ${d.alias}`.toLowerCase().includes(ql)) : data.detalleIndirectos;

  return (
    <>
      <div className="stats">
        <Tile v={fmtCompact(totalReal)} l="Gasto real centro «General Refacción Centrales Térmicas»" />
        <Tile v={fmtCompact(totalPres)} l="Presupuesto de gastos Refacciones (suma del período)" />
        <Tile v={data.detalleIndirectos.length.toString()} l="Líneas de gasto en el detalle" />
      </div>
      <div className="rct-grid">
        <Panel title="Gastos RCT" hint="Presupuesto mensual de gastos (Refacciones) vs gasto real del centro de gastos indirectos.">
          <SeriesChart
            labels={months.map(labelYm)}
            series={[
              { name: "Presupuesto gastos (Refacciones)", kind: "bar", values: pres, color: "#93c5fd" },
              { name: "Gasto real (CN indirectos)", kind: "line", values: real, color: "#d97706" },
            ]}
          />
        </Panel>
        <Panel title="Monto de gastos por centro de negocio" hint="Gasto real acumulado de RCT por CN agrupado (top 14). El CN indirectos aparece destacado.">
          <HBars items={porCn} highlight={CN_INDIRECTOS} />
        </Panel>
      </div>
      <section className="summary">
        <h2>Detalles facturación DF</h2>
        <p className="hint">Líneas contables de gasto del centro de gastos indirectos de Refacciones, más recientes primero.</p>
        <input className="search-box" type="text" placeholder="Buscar en glosa, clasificadores o cuenta…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="table-scroll" style={{ maxHeight: 480, overflowY: "auto" }}>
          <table className="data-table">
            <thead>
              <tr><th>Fecha</th><th>Clasificador 1</th><th>Clasificador 2</th><th>Glosa</th><th>Cuenta</th><th>Centro de negocio</th><th style={{ textAlign: "right" }}>Monto gasto</th></tr>
            </thead>
            <tbody>
              {detalle.slice(0, 400).map((d, i) => (
                <tr key={i}>
                  <td>{d.date}</td><td>{d.c1 || "—"}</td><td>{d.c2 || "—"}</td>
                  <td className="wrap-col">{d.comment || "—"}</td><td>{d.alias}</td><td>{d.cnDesc}</td>
                  <td style={{ textAlign: "right" }}>{fmtCLP(-d.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {detalle.length > 400 && <p className="hint" style={{ marginTop: 8 }}>Mostrando 400 de {detalle.length} líneas; usa el buscador para acotar.</p>}
      </section>
    </>
  );
}

/* ───────────── 2 y 6. Venta vs Hoja de Costo ───────────── */
function VentaHc({ data, area, titulo }: { data: RctData; area: "RCT" | "INTA"; titulo: string }) {
  const rows = useMemo(() => data.gl.filter((r) => r.area === area && r.tipo === "Ganancia" && r.alias === "VENTAS"), [data, area]);
  const months = useMemo(() => monthRange(rows.map((r) => r.ym)), [rows]);
  const mensual = byMonth(rows, months);
  const acum = cumulative(mensual);
  const prefijo = area === "RCT" ? "RCT" : "INTA";
  const ppto = useMemo(() => data.ppto.filter((r) => r.cn.startsWith(prefijo) && r.alias === "VENTA"), [data, prefijo]);
  const contrato = sum(ppto.filter((r) => r.tipo === "CONTRATO"), (r) => r.importe);
  const adicional = sum(ppto.filter((r) => r.tipo === "ADICIONAL"), (r) => r.importe);
  const total = contrato + adicional;
  const totalReal = sum(mensual, (x) => x);

  const porObra = useMemo(() => {
    const real = new Map<string, number>();
    for (const r of rows) real.set(r.cn, (real.get(r.cn) ?? 0) + r.monto);
    const pr = new Map<string, number>();
    for (const r of ppto) pr.set(r.cn, (pr.get(r.cn) ?? 0) + r.importe);
    const names = new Set([...real.keys(), ...pr.keys()]);
    return [...names].map((cn) => ({ cn, real: real.get(cn) ?? 0, pres: pr.get(cn) ?? 0 })).sort((a, b) => b.real - a.real);
  }, [rows, ppto]);

  const ref = (name: string, v: number, color: string): Series => ({ name, kind: "line", values: months.map(() => v), color, dashed: true });

  return (
    <>
      <div className="stats">
        <Tile v={fmtCompact(totalReal)} l={`Venta real ${titulo}`} />
        <Tile v={fmtCompact(contrato)} l="Venta presupuestada contrato" />
        <Tile v={fmtCompact(adicional)} l="Venta presupuestada adicional" />
        <Tile v={total > 0 ? fmtPct(totalReal / total) : "—"} l="Avance venta real vs presupuesto total" color={total > 0 ? pctColor(totalReal / total) : undefined} />
      </div>
      {total === 0 && (
        <div className="rct-note">No hay hoja de costo (PPTOS) cargada para {titulo}: solo se muestra la venta real contable.</div>
      )}
      <div className="rct-grid">
        <Panel title="Venta acumulada vs hoja de costo" hint="Venta real acumulada frente a la venta presupuestada (contrato y total con adicionales).">
          <SeriesChart
            labels={months.map(labelYm)}
            series={[
              { name: "Venta real acumulada", kind: "area", values: acum, color: "#2563eb" },
              ...(total > 0 ? [ref("Presupuestada contrato", contrato, "#16a34a"), ref("Presupuestada total", total, "#d97706")] : []),
            ]}
          />
        </Panel>
        <Panel title="Ventas por mes" hint="Venta contable mensual (cuentas de ganancia, alias VENTAS).">
          <SeriesChart labels={months.map(labelYm)} series={[{ name: "Venta del mes", kind: "bar", values: mensual, color: "#2563eb" }]} />
        </Panel>
      </div>
      <section className="summary">
        <h2>Detalle por obra</h2>
        <p className="hint">Venta real contable vs venta presupuestada de la hoja de costo.</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Obra / centro de negocio</th><th style={{ textAlign: "right" }}>Venta presupuestada</th><th style={{ textAlign: "right" }}>Venta real</th><th>% avance</th></tr></thead>
            <tbody>
              {porObra.map((r) => {
                const p = r.pres > 0 ? r.real / r.pres : null;
                return (
                  <tr key={r.cn}>
                    <td className="obra-col">{r.cn}</td>
                    <td style={{ textAlign: "right" }}>{r.pres ? fmtCLP(r.pres) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{fmtCLP(r.real)}</td>
                    <td style={{ color: pctColor(p) }}>{fmtPct(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ───────────── 3. Análisis de Gasto Materiales ───────────── */
function Materiales({ data }: { data: RctData }) {
  const cnSet = useMemo(() => new Set(data.cnList), [data]);
  const filas = useMemo(() => {
    const real = new Map<string, number>();
    for (const r of data.gl) {
      if (r.area !== "RCT" || r.tipo !== "Gasto" || r.alias === "VENTAS" || MANO_OBRA.has(r.alias) || !r.cn.includes("RCT")) continue;
      real.set(r.alias, (real.get(r.alias) ?? 0) - r.monto);
    }
    const pres = new Map<string, number>();
    for (const r of data.ppto) {
      if (r.alias === "VENTA" || !r.alias || MANO_OBRA.has(r.alias) || !r.cn.includes("RCT") || !cnSet.has(r.cn)) continue;
      pres.set(r.alias, (pres.get(r.alias) ?? 0) - r.importe);
    }
    const names = new Set([...real.keys(), ...pres.keys()]);
    return [...names]
      .map((alias) => {
        const p = pres.get(alias) ?? 0;
        const rr = real.get(alias) ?? 0;
        return { alias, pres: p, real: rr, dif: p - rr, pct: p > 0 ? rr / p : null };
      })
      .sort((a, b) => b.real - a.real);
  }, [data, cnSet]);

  const conPres = filas.filter((f) => f.pres > 0);
  const totalPres = sum(filas, (f) => f.pres);
  const totalReal = sum(filas, (f) => f.real);

  return (
    <>
      <div className="stats">
        <Tile v={fmtCompact(totalPres)} l="Gasto presupuestado (sin mano de obra)" />
        <Tile v={fmtCompact(totalReal)} l="Gasto real (sin mano de obra)" />
        <Tile v={fmtCompact(totalPres - totalReal)} l="Diferencia presupuestado − real" color={totalPres - totalReal < 0 ? "var(--status-critical)" : "var(--status-good)"} />
        <Tile v={totalPres > 0 ? fmtPct(totalReal / totalPres) : "—"} l="% de avance gastos" color={totalPres > 0 ? pctColor(totalReal / totalPres) : undefined} />
      </div>
      <Panel title="Gasto presupuestado y gasto real por alias" hint="Solo alias con presupuesto en la hoja de costo.">
        <SeriesChart
          height={300}
          labels={conPres.map((f) => (f.alias.length > 16 ? f.alias.slice(0, 15) + "…" : f.alias))}
          series={[
            { name: "Gasto presupuestado", kind: "bar", values: conPres.map((f) => f.pres), color: "#93c5fd" },
            { name: "Gasto real", kind: "bar", values: conPres.map((f) => f.real), color: "#d97706" },
          ]}
        />
      </Panel>
      <section className="summary">
        <h2>Detalles de gastos por proyecto</h2>
        <p className="hint">Excluye mano de obra y ventas. Diferencia = presupuestado − real (negativo: sobre el presupuesto).</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Alias</th><th style={{ textAlign: "right" }}>Gasto presupuestado</th><th style={{ textAlign: "right" }}>Gasto real</th><th style={{ textAlign: "right" }}>Diferencia</th><th>% avance</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.alias}>
                  <td className="obra-col">{f.alias}</td>
                  <td style={{ textAlign: "right" }}>{f.pres ? fmtCLP(f.pres) : "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmtCLP(f.real)}</td>
                  <td style={{ textAlign: "right", color: f.dif < 0 ? "var(--status-critical)" : undefined }}>{f.pres ? fmtCLP(f.dif) : "—"}</td>
                  <td style={{ color: pctColor(f.pct) }}>{fmtPct(f.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ───────────── 4. Análisis PPTOS adicionales ───────────── */
const ESTADO_COLOR: Record<string, string> = { APROBADO: "#16a34a", PENDIENTE: "#d97706", RECHAZADO: "#dc2626" };

function Adicionales({ data }: { data: RctData }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => data.adicionales.filter((a) => a.estado === "PENDIENTE" || a.estado === "APROBADO"), [data]);
  const estados = ["APROBADO", "PENDIENTE"];
  const porCant = estados.map((e) => ({ label: e, value: rows.filter((r) => r.estado === e).length, color: ESTADO_COLOR[e] }));
  const porUf = estados.map((e) => ({ label: e, value: sum(rows.filter((r) => r.estado === e), (r) => r.valorUf), color: ESTADO_COLOR[e] }));
  const aprobados = rows.filter((r) => r.estado === "APROBADO" && (r.fac === "SI" || r.fac === "NO"));
  const fac = ["SI", "NO"].map((k) => ({ label: k === "SI" ? "Facturado" : "Sin facturar", value: sum(aprobados.filter((r) => r.fac === k), (r) => r.valorUf), color: k === "SI" ? "#16a34a" : "#d97706" }));
  const porObra = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const o = m.get(r.obra) ?? {};
      o[r.estado] = (o[r.estado] ?? 0) + r.valorUf;
      m.set(r.obra, o);
    }
    return [...m.entries()].map(([label, values]) => ({ label, values })).sort((a, b) => sum(Object.values(b.values), (x) => x) - sum(Object.values(a.values), (x) => x)).slice(0, 18);
  }, [rows]);

  const ql = q.trim().toLowerCase();
  const tabla = ql ? rows.filter((r) => `${r.obra} ${r.asunto} ${r.codigo}`.toLowerCase().includes(ql)) : rows;
  const totUf = sum(rows, (r) => r.valorUf);
  const aprUf = porUf[0].value;
  const facUf = fac[0].value;

  return (
    <>
      <div className="stats">
        <Tile v={`${fmtNum(totUf, 1)} UF`} l="Adicionales aprobados + pendientes" />
        <Tile v={`${fmtNum(aprUf, 1)} UF`} l="Aprobados" color="var(--status-good)" />
        <Tile v={totUf > 0 ? fmtPct(aprUf / totUf) : "—"} l="Tasa de aprobación (UF)" />
        <Tile v={aprUf > 0 ? fmtPct(facUf / aprUf) : "—"} l="Facturado sobre lo aprobado (UF)" />
      </div>
      <div className="rct-grid three">
        <Panel title="Tasa de aprobación por cantidad"><Pie slices={porCant} /></Panel>
        <Panel title="Tasa de aprobación por monto UF"><Pie slices={porUf} format={(n) => `${fmtNum(n, 1)} UF`} /></Panel>
        <Panel title="Facturación de adicionales aprobados"><Pie slices={fac} format={(n) => `${fmtNum(n, 1)} UF`} /></Panel>
      </div>
      <Panel title="UF por obra y estado" hint="Distribución de cada obra entre adicionales aprobados y pendientes.">
        <Stacked100 rows={porObra} keys={estados} colors={ESTADO_COLOR} />
      </Panel>
      <section className="summary">
        <h2>Detalles</h2>
        <input className="search-box" type="text" placeholder="Buscar obra, asunto o código…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Código</th><th>Obra</th><th>Asunto</th><th style={{ textAlign: "right" }}>UF</th><th style={{ textAlign: "right" }}>Monto CLP</th><th>Estado</th><th>Fecha apr.</th><th>¿Fact.?</th><th>Fecha fact.</th></tr></thead>
            <tbody>
              {tabla.map((r, i) => (
                <tr key={i}>
                  <td>{r.codigo}</td><td className="obra-col">{r.obra}</td><td className="wrap-col">{r.asunto}</td>
                  <td style={{ textAlign: "right" }}>{fmtNum(r.valorUf, 2)}</td><td style={{ textAlign: "right" }}>{fmtCLP(r.montoClp)}</td>
                  <td><span className={`status-chip ${r.estado === "APROBADO" ? "good" : "warning"}`}>{r.estado}</span></td>
                  <td>{r.fechaApr ?? "—"}</td><td>{r.fac || "—"}</td><td>{r.fechaFac ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ───────────── 5. Avance operativo ───────────── */
function Avance({ data }: { data: RctData }) {
  const sup = useMemo(() => new Map(data.obraSupervisor.map((o) => [o.obra.trim().toLowerCase(), o.supervisor])), [data]);
  const filas = useMemo(() => {
    const real = new Map<string, number>();
    for (const r of data.gl) if (r.area === "INTA" && r.tipo === "Ganancia") real.set(r.cn, (real.get(r.cn) ?? 0) + r.monto);
    const pres = new Map<string, number>();
    for (const r of data.ppto) if (r.alias === "VENTA") pres.set(r.cn, (pres.get(r.cn) ?? 0) + r.importe);
    const names = new Set([...real.keys(), ...data.obraSupervisor.map((o) => o.obra)]);
    return [...names]
      .map((cn) => {
        const rr = real.get(cn) ?? 0;
        const pp = pres.get(cn) ?? 0;
        return { cn, supervisor: sup.get(cn.trim().toLowerCase()) || "—", real: rr, pres: pp, pct: pp > 0 ? rr / pp : null };
      })
      .sort((a, b) => a.supervisor.localeCompare(b.supervisor) || b.real - a.real);
  }, [data, sup]);
  const porSup = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of filas) if (f.supervisor !== "—") m.set(f.supervisor, (m.get(f.supervisor) ?? 0) + f.real);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [filas]);

  return (
    <>
      <div className="stats">
        <Tile v={fmtCompact(sum(filas, (f) => f.real))} l="Venta real INTA (suma de obras)" />
        <Tile v={fmtCompact(sum(filas, (f) => f.pres))} l="Venta presupuestada total" />
        <Tile v={String(filas.filter((f) => f.supervisor !== "—").length)} l="Obras con supervisor asignado" />
      </div>
      <div className="rct-grid">
        <Panel title="Venta real por supervisor" hint="Suma de la venta contable de las obras de cada supervisor.">
          <HBars items={porSup} />
        </Panel>
        <section className="summary" style={{ marginTop: 0 }}>
          <h2>Detalles</h2>
          <p className="hint">Obra, supervisor, venta real y avance contra la venta presupuestada.</p>
          <div className="table-scroll" style={{ maxHeight: 420, overflowY: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Supervisor</th><th>Obra</th><th style={{ textAlign: "right" }}>Venta real</th><th style={{ textAlign: "right" }}>Venta presup.</th><th>% avance</th></tr></thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.cn}>
                    <td>{f.supervisor}</td><td className="obra-col">{f.cn}</td>
                    <td style={{ textAlign: "right" }}>{fmtCLP(f.real)}</td>
                    <td style={{ textAlign: "right" }}>{f.pres ? fmtCLP(f.pres) : "—"}</td>
                    <td style={{ color: pctColor(f.pct) }}>{fmtPct(f.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

/* ───────────── 7. Gasto vs Hoja de Costo ───────────── */
function GastoHc({ data }: { data: RctData }) {
  const rows = useMemo(() => data.gl.filter((r) => r.area === "RCT" && r.tipo === "Gasto" && r.alias !== "VENTAS" && r.ym >= "2020-01"), [data]);
  const months = useMemo(() => monthRange(rows.map((r) => r.ym)), [rows]);
  const mensual = byMonth(rows, months, -1);
  const acum = cumulative(mensual);
  const pres = -sum(data.ppto.filter((r) => r.alias !== "VENTA"), (r) => r.importe);
  const real = sum(mensual, (x) => x);

  return (
    <>
      <div className="stats">
        <Tile v={fmtCompact(real)} l="Gasto real RCT acumulado" />
        <Tile v={fmtCompact(pres)} l="Gasto presupuestado (hoja de costo)" />
        <Tile v={fmtCompact(pres - real)} l="Diferencia presupuestado − real" color={pres - real < 0 ? "var(--status-critical)" : "var(--status-good)"} />
        <Tile v={pres > 0 ? fmtPct(real / pres) : "—"} l="% de avance de gasto" color={pres > 0 ? pctColor(real / pres) : undefined} />
      </div>
      <div className="rct-grid">
        <Panel title="Gasto acumulado vs gasto presupuestado" hint="Gasto real acumulado de RCT frente al total presupuestado en la hoja de costo.">
          <SeriesChart
            labels={months.map(labelYm)}
            series={[
              { name: "Gasto real acumulado", kind: "area", values: acum, color: "#d97706" },
              { name: "Gasto presupuestado", kind: "line", values: months.map(() => pres), color: "#2563eb", dashed: true },
            ]}
          />
        </Panel>
        <Panel title="Gasto por mes" hint="Gasto contable mensual de Refacciones (sin cuentas de venta).">
          <SeriesChart labels={months.map(labelYm)} series={[{ name: "Gasto del mes", kind: "bar", values: mensual, color: "#d97706" }]} />
        </Panel>
      </div>
    </>
  );
}
