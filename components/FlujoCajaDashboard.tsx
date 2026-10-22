"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FlujoData } from "@/lib/flujo/types";
import TopNav from "./TopNav";
import { HBars, Pie, SeriesChart, fmtCLP, fmtCompact, fmtNum, fmtPct, labelYm } from "./RctCharts";
import "../app/dashboard.css";
import "../app/rct/rct.css";
import "../app/estado-resultado/eerr.css";
import "../app/flujo-caja/flujo.css";

const C_ING = "#16a34a";
const C_EGR = "#dc2626";
const C_ACUM = "#2563eb";
const C_RES = "#d97706";
const C_MO = "#7c3aed";
const C_CERT = "#0891b2";

type Prov = "Con" | "Sin";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "caja", label: "Flujo de caja" },
  { id: "rent", label: "Rentabilidad" },
  { id: "proyectos", label: "Proyectos" },
  { id: "factura", label: "Facturación pendiente" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const add = (...as: number[][]) => as[0].map((_, i) => as.reduce((s, a) => s + (a[i] ?? 0), 0));
const sub = (a: number[], b: number[]) => a.map((x, i) => x - (b[i] ?? 0));
const cum = (a: number[]) => {
  let t = 0;
  return a.map((x) => (t += x));
};
const div = (a: number, b: number): number | null => (b ? a / b : null);
const tone = (v: number) => (v > 0 ? "var(--status-good)" : v < 0 ? "var(--status-critical)" : undefined);

/** Valores de la tabla en miles de pesos para que quepan los 20 meses. */
const miles = (n: number) => (Math.abs(n) < 0.5 ? "–" : fmtNum(n / 1000));

/* ───────────── UI base ───────────── */
function Kpi({ v, l, sub: s, color }: { v: string; l: string; sub?: string; color?: string }) {
  return (
    <div className="stat-tile">
      <div className="v" style={color ? { color } : undefined}>{v}</div>
      <div className="l">{l}</div>
      {s && <div className="flujo-kpi-sub">{s}</div>}
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

/** Tabla mensual (en miles de CLP): una fila por concepto y una columna por mes, más el total. */
interface Fila { label: string; values: number[]; kind?: "total" | "sub" | "plain"; signed?: boolean }
function TablaMensual({ months, rows }: { months: string[]; rows: Fila[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table flujo-table">
        <thead>
          <tr>
            <th>Miles de CLP</th>
            {months.map((m) => <th key={m} style={{ textAlign: "right" }}>{labelYm(m)}</th>)}
            <th style={{ textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const total = r.kind === "total" && r.label.toLowerCase().includes("acumulado") ? null : sum(r.values);
            return (
              <tr key={r.label} className={r.kind === "total" ? "eerr-total" : r.kind === "sub" ? "eerr-l2" : undefined}>
                <td>{r.label}</td>
                {r.values.map((v, i) => (
                  <td key={i} style={{ textAlign: "right", color: r.signed ? tone(v) : undefined }}>{miles(v)}</td>
                ))}
                <td style={{ textAlign: "right", fontWeight: 650, color: r.signed && total !== null ? tone(total) : undefined }}>{total === null ? "" : miles(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────── Cálculos según el filtro de provisionamiento ───────────── */
function useModelo(d: FlujoData, prov: Prov) {
  return useMemo(() => {
    const zero = d.months.map(() => 0);
    const incl = (a: number[]) => (prov === "Con" ? a : zero);
    const cobros = add(d.cobros.metrogas, d.cobros.comunidad, d.cobros.entregados, incl(d.cobros.provision));
    const pagos = add(d.pagos.materiales, d.pagos.manoObra);
    const pagosTot = add(pagos, d.indirecto);
    const neto = sub(cobros, pagosTot);
    const acum = cum(neto);

    const ingresos = add(d.rent.venta, d.rent.entregados, incl(d.rent.provision));
    const costos = add(d.rent.manoObra, d.rent.materiales, d.rent.certificacion);
    const margen = sub(ingresos, costos);
    const resultado = sub(margen, d.rent.indirecto);
    const resAcum = cum(resultado);

    // Referencia sin provisionamiento, para comparar.
    const cobrosSin = add(d.cobros.metrogas, d.cobros.comunidad, d.cobros.entregados);
    const acumSin = cum(sub(cobrosSin, pagosTot));
    const acumCon = cum(sub(add(cobrosSin, d.cobros.provision), pagosTot));

    const minI = acum.reduce((m, v, i) => (v < acum[m] ? i : m), 0);
    const peorI = neto.reduce((m, v, i) => (v < neto[m] ? i : m), 0);
    return { cobros, pagos, pagosTot, neto, acum, ingresos, costos, margen, resultado, resAcum, acumSin, acumCon, minI, peorI };
  }, [d, prov]);
}
type Modelo = ReturnType<typeof useModelo>;

interface Props { d: FlujoData; m: Modelo; prov: Prov }

/* ───────────── 1. Resumen ───────────── */
function Resumen({ d, m, prov }: Props) {
  const labels = d.months.map(labelYm);
  const venta = sum(m.ingresos);
  const dirMargen = sum(m.margen);
  const resultado = sum(m.resultado);
  const extra = sum(d.cobros.provision);
  return (
    <>
      <div className="stats">
        <Kpi v={fmtCLP(sum(m.neto))} l="Flujo neto total del área (c/IVA)" color={tone(sum(m.neto))} />
        <Kpi v={fmtCLP(sum(m.cobros))} l="Total cobros" color={C_ING} />
        <Kpi v={fmtCLP(sum(m.pagosTot))} l="Total pagos + costo indirecto" color={C_EGR} />
        <Kpi v={fmtCLP(m.acum[m.minI])} l="Saldo acumulado mínimo" sub={labelYm(d.months[m.minI])} color={tone(m.acum[m.minI])} />
        <Kpi v={fmtCLP(m.neto[m.peorI])} l="Peor flujo mensual" sub={labelYm(d.months[m.peorI])} color={tone(m.neto[m.peorI])} />
      </div>
      <div className="stats">
        <Kpi v={fmtCLP(venta)} l="Ventas totales (sin IVA)" />
        <Kpi v={fmtCLP(sum(m.costos))} l="Costos directos" color={C_EGR} />
        <Kpi v={fmtCLP(dirMargen)} l="Margen directo" sub={fmtPct(div(dirMargen, venta))} color={C_ING} />
        <Kpi v={fmtCLP(sum(d.rent.indirecto))} l="Costo indirecto total" />
        <Kpi v={fmtCLP(resultado)} l="Resultado del área" sub={`${fmtPct(div(resultado, venta))} sobre la venta`} color={tone(resultado)} />
      </div>
      {prov === "Con" && (
        <div className="rct-note" style={{ marginTop: 0, marginBottom: 14 }}>
          Incluye el cobro de {fmtCLP(extra)} (c/IVA) de las cuotas con provisionamiento de proyectos entregados ({fmtCLP(sum(d.rent.provision))} netos de ingreso).
        </div>
      )}
      <div className="rct-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Panel title="Flujo de caja mensual" hint="Barras: flujo neto del mes. Línea: flujo de caja acumulado.">
          <SeriesChart
            labels={labels}
            series={[
              { name: "Flujo neto del mes", kind: "bar", values: m.neto, color: C_ING },
              { name: "Flujo acumulado", kind: "line", values: m.acum, color: C_ACUM },
            ]}
          />
        </Panel>
        <Panel title="Rentabilidad mensual" hint="Barras: resultado del mes (sin IVA, devengado). Línea: resultado acumulado.">
          <SeriesChart
            labels={labels}
            series={[
              { name: "Resultado del mes", kind: "bar", values: m.resultado, color: C_RES },
              { name: "Resultado acumulado", kind: "line", values: m.resAcum, color: C_ACUM },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Efecto del provisionamiento en la caja" hint="Flujo de caja acumulado con y sin las cuotas con provisionamiento de proyectos entregados.">
        <SeriesChart
          labels={labels}
          series={[
            { name: "Sin provisionamiento", kind: "line", values: m.acumSin, color: C_ACUM, dashed: prov === "Con" },
            { name: "Con provisionamiento", kind: "line", values: m.acumCon, color: C_ING, dashed: prov === "Sin" },
          ]}
        />
      </Panel>
    </>
  );
}

/* ───────────── 2. Flujo de caja ───────────── */
function Caja({ d, m, prov }: Props) {
  const labels = d.months.map(labelYm);
  const conProv = prov === "Con";
  const zero = d.months.map(() => 0);
  const prv = conProv ? d.cobros.provision : zero;
  const rows: Fila[] = [
    { label: "Cobro Metrogas", values: d.cobros.metrogas, kind: "sub" },
    { label: "Cobro Comunidad", values: d.cobros.comunidad, kind: "sub" },
    { label: "Cobro proyectos entregados (cuotas pendientes)", values: d.cobros.entregados, kind: "sub" },
    ...(conProv ? [{ label: "Cobro cuotas con provisionamiento", values: prv, kind: "sub" as const }] : []),
    { label: "Total cobros", values: m.cobros, kind: "total" },
    { label: "Pago materiales / equipos / certificación", values: d.pagos.materiales, kind: "sub" },
    { label: "Pago mano de obra", values: d.pagos.manoObra, kind: "sub" },
    { label: "Total pagos", values: m.pagos, kind: "total" },
    { label: "Costo indirecto (sueldos oficina)", values: d.indirecto, kind: "sub" },
    { label: "Flujo neto del mes", values: m.neto, kind: "total", signed: true },
    { label: "Flujo de caja acumulado", values: m.acum, kind: "total", signed: true },
    { label: "N° proyectos en curso", values: d.proyectosEnCurso, kind: "sub" },
  ];
  const cobroSlices = [
    { label: "Metrogas", value: sum(d.cobros.metrogas), color: C_ACUM },
    { label: "Comunidad", value: sum(d.cobros.comunidad), color: C_ING },
    { label: "Proyectos entregados", value: sum(d.cobros.entregados), color: C_RES },
    ...(conProv ? [{ label: "Cuotas con provisionamiento", value: sum(prv), color: C_MO }] : []),
  ];
  const pagoSlices = [
    { label: "Materiales / equipos / cert.", value: sum(d.pagos.materiales), color: C_EGR },
    { label: "Mano de obra", value: sum(d.pagos.manoObra), color: C_MO },
    { label: "Costo indirecto", value: sum(d.indirecto), color: C_RES },
  ];
  return (
    <>
      <Panel title="Cobros vs pagos por mes" hint="Cobros (c/IVA) frente a pagos de proyectos más costo indirecto; la línea es el flujo neto del mes.">
        <SeriesChart
          labels={labels}
          series={[
            { name: "Cobros", kind: "bar", values: m.cobros, color: C_ING },
            { name: "Pagos + indirecto", kind: "bar", values: m.pagosTot, color: C_EGR },
            { name: "Flujo neto", kind: "line", values: m.neto, color: C_ACUM },
          ]}
        />
      </Panel>
      <div className="rct-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Panel title="¿De dónde vienen los cobros?" hint="Composición del total cobrado en el período.">
          <Pie slices={cobroSlices} format={fmtCompact} />
        </Panel>
        <Panel title="¿En qué se va la caja?" hint="Composición de pagos y costo indirecto.">
          <Pie slices={pagoSlices} format={fmtCompact} />
        </Panel>
      </div>
      <section className="summary">
        <h2>Flujo de caja consolidado</h2>
        <p className="hint">Base percibido, CLP con IVA, calendarizado según el mes del primer pago de cada proyecto.</p>
        <TablaMensual months={d.months} rows={rows} />
      </section>
    </>
  );
}

/* ───────────── 3. Rentabilidad ───────────── */
function Rentabilidad({ d, m, prov }: Props) {
  const labels = d.months.map(labelYm);
  const conProv = prov === "Con";
  const venta = sum(m.ingresos);
  const margenPct = m.ingresos.map((v, i) => (v ? m.margen[i] / v : null));
  const rows: Fila[] = [
    { label: "Ingresos por venta (13 proyectos)", values: d.rent.venta, kind: "sub" },
    { label: "Ingresos proyectos entregados", values: d.rent.entregados, kind: "sub" },
    ...(conProv ? [{ label: "Ingresos cuotas con provisionamiento", values: d.rent.provision, kind: "sub" as const }] : []),
    { label: "Total ingresos", values: m.ingresos, kind: "total" },
    { label: "Mano de obra", values: d.rent.manoObra, kind: "sub" },
    { label: "Materiales", values: d.rent.materiales, kind: "sub" },
    { label: "Certificación y otros", values: d.rent.certificacion, kind: "sub" },
    { label: "Total costos directos", values: m.costos, kind: "total" },
    { label: "Margen directo proyectos", values: m.margen, kind: "total", signed: true },
    { label: "Costo indirecto (sueldos oficina)", values: d.rent.indirecto, kind: "sub" },
    { label: "Resultado del mes", values: m.resultado, kind: "total", signed: true },
    { label: "Resultado acumulado", values: m.resAcum, kind: "total", signed: true },
  ];
  return (
    <>
      <div className="stats">
        <Kpi v={fmtCLP(venta)} l="Ingresos (sin IVA)" color={C_ING} />
        <Kpi v={fmtCLP(sum(m.costos))} l="Costos directos" sub={fmtPct(div(sum(m.costos), venta))} color={C_EGR} />
        <Kpi v={fmtCLP(sum(m.margen))} l="Margen directo" sub={fmtPct(div(sum(m.margen), venta))} color={tone(sum(m.margen))} />
        <Kpi v={fmtCLP(sum(m.resultado))} l="Resultado del área" sub={fmtPct(div(sum(m.resultado), venta))} color={tone(sum(m.resultado))} />
      </div>
      <div className="rct-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <Panel title="Ingresos vs costos directos" hint="Base devengado, sin IVA. La línea es el resultado del mes después del costo indirecto.">
          <SeriesChart
            labels={labels}
            series={[
              { name: "Ingresos", kind: "bar", values: m.ingresos, color: C_ING },
              { name: "Costos directos", kind: "bar", values: m.costos, color: C_EGR },
              { name: "Resultado del mes", kind: "line", values: m.resultado, color: C_RES },
            ]}
          />
        </Panel>
        <Panel title="Costos directos" hint="Composición del costo directo del período.">
          <Pie
            slices={[
              { label: "Materiales", value: sum(d.rent.materiales), color: C_EGR },
              { label: "Certificación y otros", value: sum(d.rent.certificacion), color: C_CERT },
              { label: "Mano de obra", value: sum(d.rent.manoObra), color: C_MO },
            ]}
            format={fmtCompact}
          />
        </Panel>
      </div>
      <Panel title="Margen directo sobre ingresos" hint="Porcentaje mensual; los meses con costo anticipado (materiales) quedan en negativo.">
        <SeriesChart labels={labels} series={[{ name: "Margen directo %", kind: "line", values: margenPct, color: C_ACUM }]} format={(n) => fmtPct(n)} />
      </Panel>
      <section className="summary">
        <h2>Rentabilidad consolidada</h2>
        <p className="hint">Base devengado, CLP sin IVA.</p>
        <TablaMensual months={d.months} rows={rows} />
      </section>
    </>
  );
}

/* ───────────── 4. Proyectos ───────────── */
function Proyectos({ d }: Props) {
  const labels = d.months.map(labelYm);
  const maxAbs = Math.max(1, ...d.proyectos.flatMap((p) => p.flujo.map((v) => Math.abs(v))));
  const heat = (v: number) => {
    if (Math.abs(v) < 0.5) return undefined;
    const a = Math.min(0.55, 0.08 + (Math.abs(v) / maxAbs) * 0.5);
    return v > 0 ? `rgba(22,163,74,${a})` : `rgba(220,38,38,${a})`;
  };
  const ordenados = [...d.proyectos].sort((a, b) => b.flujoNeto - a.flujoNeto);
  return (
    <>
      <div className="rct-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Panel title="Flujo neto por proyecto" hint="Suma de los 14 meses de cada modelo, CLP con IVA.">
          <HBars items={ordenados.map((p) => ({ label: p.nombre, value: p.flujoNeto }))} color={C_ACUM} />
        </Panel>
        <Panel title="Margen sobre venta por proyecto" hint="Resultado del proyecto (sin IVA) sobre su venta.">
          <HBars
            items={[...d.proyectos].sort((a, b) => b.margen - a.margen).map((p) => ({ label: p.nombre, value: p.margen }))}
            format={(n) => fmtPct(n)}
            color={C_ING}
          />
        </Panel>
      </div>
      <Panel title="Proyectos en curso" hint="Cantidad de proyectos dentro de sus 14 meses de modelo, mes a mes.">
        <SeriesChart labels={labels} series={[{ name: "Proyectos en curso", kind: "bar", values: d.proyectosEnCurso, color: C_ACUM }]} format={(n) => fmtNum(n)} height={200} />
      </Panel>
      <section className="summary">
        <h2>Resumen por proyecto</h2>
        <p className="hint">Un proyecto parte cuando se cobra su primer pago (Metrogas + comunidad); su modelo de caja dura 14 meses.</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Primer pago</th>
                <th>Último mes caja</th>
                <th style={{ textAlign: "right" }}>Flujo neto (c/IVA)</th>
                <th style={{ textAlign: "right" }}>Resultado (sin IVA)</th>
                <th style={{ textAlign: "right" }}>Margen</th>
              </tr>
            </thead>
            <tbody>
              {d.proyectos.map((p) => (
                <tr key={p.nombre}>
                  <td>{p.nombre}</td>
                  <td>{p.primerPago ? labelYm(p.primerPago) : "—"}</td>
                  <td>{p.ultimo ? labelYm(p.ultimo) : "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmtCLP(p.flujoNeto)}</td>
                  <td style={{ textAlign: "right" }}>{fmtCLP(p.resultado)}</td>
                  <td style={{ textAlign: "right" }}>{fmtPct(p.margen)}</td>
                </tr>
              ))}
              <tr className="eerr-total">
                <td>Total</td>
                <td />
                <td />
                <td style={{ textAlign: "right" }}>{fmtCLP(sum(d.proyectos.map((p) => p.flujoNeto)))}</td>
                <td style={{ textAlign: "right" }}>{fmtCLP(sum(d.proyectos.map((p) => p.resultado)))}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="summary">
        <h2>Mapa de calor: flujo neto por proyecto y mes</h2>
        <p className="hint">Verde = caja positiva, rojo = caja negativa (la intensidad indica el monto). En miles de CLP.</p>
        <div className="table-scroll">
          <table className="data-table flujo-table">
            <thead>
              <tr>
                <th>Proyecto</th>
                {d.months.map((mm) => <th key={mm} style={{ textAlign: "right" }}>{labelYm(mm)}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.proyectos.map((p) => (
                <tr key={p.nombre}>
                  <td>{p.nombre}</td>
                  {p.flujo.map((v, i) => (
                    <td key={i} style={{ textAlign: "right", background: heat(v) }}>{miles(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ───────────── 5. Facturación pendiente ───────────── */
function Factura({ d, prov }: Props) {
  const labels = d.months.map(labelYm);
  const sin = d.facturacion.filter((f) => !f.provision);
  const con = d.facturacion.filter((f) => f.provision);
  const mesSin = d.months.map((_, i) => sum(sin.map((f) => f.meses[i])));
  const mesCon = d.months.map((_, i) => sum(con.map((f) => f.meses[i])));
  const firstI = d.facturacion.length ? d.months.findIndex((_, i) => d.facturacion.some((f) => f.meses[i] > 0)) : 0;
  const porProyecto = new Map<string, number>();
  for (const f of d.facturacion) if (prov === "Con" || !f.provision) porProyecto.set(f.proyecto, (porProyecto.get(f.proyecto) ?? 0) + f.total);
  const items = [...porProyecto.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const iva = 1 + d.iva;
  return (
    <>
      <div className="stats">
        <Kpi v={fmtCLP(sum(mesSin))} l="Facturación pendiente sin provisionamiento (neto)" sub={`${fmtCLP(sum(mesSin) * iva)} c/IVA`} color={C_ING} />
        <Kpi v={fmtCLP(sum(mesCon))} l="Cuotas con provisionamiento (neto)" sub={`${fmtCLP(sum(mesCon) * iva)} c/IVA`} color={C_MO} />
        <Kpi v={fmtCLP(sum(mesSin) + sum(mesCon))} l="Total facturación pendiente (neto)" />
        <Kpi v={String(porProyecto.size)} l={prov === "Con" ? "Proyectos entregados con saldo" : "Proyectos entregados con saldo (sin provisionamiento)"} />
      </div>
      <div className="rct-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <Panel
          title="Facturación pendiente por mes"
          hint={`Neto a facturar desde ${firstI >= 0 ? labelYm(d.months[firstI]) : "—"}. Se cobra ${d.desfaseCobro} mes después de facturar, con IVA.`}
        >
          <SeriesChart
            labels={labels}
            series={[
              { name: "Sin provisionamiento", kind: "bar", values: mesSin, color: C_ING },
              { name: "Con provisionamiento", kind: "bar", values: mesCon, color: C_MO },
            ]}
          />
        </Panel>
        <Panel title="Saldo por proyecto" hint={prov === "Con" ? "Incluye cuotas con provisionamiento." : "Sin cuotas con provisionamiento."}>
          <HBars items={items} color={C_ACUM} />
        </Panel>
      </div>
      <section className="summary">
        <h2>Detalle por proyecto entregado</h2>
        <p className="hint">Las cuotas «con provisionamiento» solo se suman al flujo cuando eliges «Con provisionamiento».</p>
        <div className="table-scroll">
          <table className="data-table flujo-table">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Concepto</th>
                <th>Provisión</th>
                {d.months.slice(firstI).map((mm) => <th key={mm} style={{ textAlign: "right" }}>{labelYm(mm)}</th>)}
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {d.facturacion.map((f, i) => (
                <tr key={i} className={f.provision && prov === "Sin" ? "flujo-excluida" : undefined}>
                  <td>{f.proyecto}</td>
                  <td>{f.concepto}</td>
                  <td><span className={`flujo-badge ${f.provision ? "si" : "no"}`}>{f.provision ? "Sí" : "No"}</span></td>
                  {f.meses.slice(firstI).map((v, j) => <td key={j} style={{ textAlign: "right" }}>{v ? fmtNum(v / 1000) : "–"}</td>)}
                  <td style={{ textAlign: "right", fontWeight: 650 }}>{fmtNum(f.total / 1000)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Montos netos (sin IVA) en miles de CLP.</p>
      </section>
    </>
  );
}

/* ───────────── Página ───────────── */
export default function FlujoCajaDashboard({ data, error, generatedAt }: { data: FlujoData | null; error: string | null; generatedAt: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("resumen");
  const [prov, setProv] = useState<Prov>("Sin");

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const head = (
    <>
      <TopNav active="flujo" />
      <header className="page-head">
        <h1>Flujo de Caja Consolidado</h1>
        <p className="sub">Flujo de caja y rentabilidad del área Refacción NEB Chile: 13 proyectos más la facturación pendiente de proyectos entregados</p>
        <div className="meta">
          {data && (
            <>
              <span>{data.months.length ? `${labelYm(data.months[0])} a ${labelYm(data.months[data.months.length - 1])}` : ""} · {data.proyectos.length} proyectos</span>
              <span className="dot" />
              <span>Leído {new Date(generatedAt).toLocaleString("es-CL")}</span>
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

  return <Contenido head={head} data={data} tab={tab} setTab={setTab} prov={prov} setProv={setProv} />;
}

function Contenido({ head, data, tab, setTab, prov, setProv }: { head: React.ReactNode; data: FlujoData; tab: TabId; setTab: (t: TabId) => void; prov: Prov; setProv: (p: Prov) => void }) {
  const m = useModelo(data, prov);
  const props: Props = { d: data, m, prov };
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
          <div className="seg" role="group" aria-label="Provisionamiento">
            <span>Cuotas con provisionamiento</span>
            <div>
              {(["Sin", "Con"] as Prov[]).map((p) => (
                <button key={p} className={prov === p ? "on" : ""} onClick={() => setProv(p)}>{p === "Sin" ? "Sin provisionamiento" : "Con provisionamiento"}</button>
              ))}
            </div>
          </div>
        </div>

        {tab === "resumen" && <Resumen {...props} />}
        {tab === "caja" && <Caja {...props} />}
        {tab === "rent" && <Rentabilidad {...props} />}
        {tab === "proyectos" && <Proyectos {...props} />}
        {tab === "factura" && <Factura {...props} />}

        <footer className="note">
          <strong>Sobre esta página:</strong> lee el Excel «{data.archivo}» (Drive). Caja: CLP con IVA, base percibido; rentabilidad: CLP sin IVA, base devengado. El filtro agrega las cuotas con
          provisionamiento (Las Hortensias, Magdalena, Claudio Gay, Hernando de Aguirre, Ejército Libertador, Echaurren y Tarapacá) que el Excel deja fuera por defecto.
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer" }}>Supuestos del modelo</summary>
            <ol style={{ margin: "6px 0 0 18px", padding: 0 }}>
              {data.notas.map((n, i) => <li key={i}>{n.replace(/^\d+\)\s*/, "")}</li>)}
            </ol>
          </details>
        </footer>
      </div>
    </div>
  );
}
