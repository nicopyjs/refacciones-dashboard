"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SegEdificio, SegEstado, SeguimientoData } from "@/lib/seguimiento/types";
import TopNav from "./TopNav";
import { HBars } from "./RctCharts";
import "../app/dashboard.css";
import "../app/rct/rct.css";
import "../app/estado-resultado/eerr.css";
import "../app/flujo-caja/flujo.css";

const TABS = [
  { id: "seguimiento", label: "Seguimiento" },
  { id: "resumen", label: "Resumen" },
  { id: "etapas", label: "Etapas" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const ESTADO_COLOR: Record<SegEstado, string> = {
  "En curso": "var(--accent)",
  Atrasado: "var(--status-critical)",
  "En rechazo": "var(--status-warning)",
  Completo: "var(--status-good)",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const fecha = (s: string) => (s ? s.split("-").reverse().join("-") : "–");

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

function EstadoBadge({ estado }: { estado: SegEdificio["estado"] }) {
  if (!estado) return <span>–</span>;
  const c = ESTADO_COLOR[estado];
  return (
    <span className="flujo-badge" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c }}>
      {estado}
    </span>
  );
}

function Firma({ v }: { v: string }) {
  return v ? <span className={`flujo-badge ${v === "Sí" ? "si" : "no"}`}>{v}</span> : <span>–</span>;
}

function Barra({ v }: { v: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 90 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ width: pct(v), height: "100%", background: "var(--accent)" }} />
      </div>
      <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{pct(v)}</span>
    </div>
  );
}

/* ───────────── Pestañas ───────────── */
function Seguimiento({ d }: { d: SeguimientoData }) {
  const [estado, setEstado] = useState<SegEstado | "Todos">("Todos");
  const r = d.resumen;
  const filas = useMemo(() => d.edificios.filter((e) => estado === "Todos" || e.estado === estado), [d.edificios, estado]);
  const opciones: (SegEstado | "Todos")[] = ["Todos", "En curso", "Atrasado", "En rechazo", "Completo"];

  return (
    <>
      <div className="stats">
        <Kpi v={String(r.total)} l="Edificios en seguimiento" />
        <Kpi v={String(r.enCurso)} l="En curso" color={ESTADO_COLOR["En curso"]} />
        <Kpi v={String(r.atrasados)} l={`Atrasados (más de ${d.diasMaxEtapa} días en la etapa)`} color={r.atrasados ? ESTADO_COLOR.Atrasado : undefined} />
        <Kpi v={String(r.completos)} l="Proceso completo" color={ESTADO_COLOR.Completo} />
      </div>

      <div className="rct-filters">
        <div className="seg" role="group" aria-label="Estado">
          <span>Estado</span>
          <div>
            {opciones.map((o) => (
              <button key={o} className={estado === o ? "on" : ""} onClick={() => setEstado(o)}>{o}</button>
            ))}
          </div>
        </div>
      </div>

      <section className="summary">
        <h2>Contratos por edificio</h2>
        <div className="table-scroll">
          <table className="data-table flujo-table">
            <thead>
              <tr>
                <th>Edificio</th>
                <th>Comuna</th>
                <th>Código prospecto</th>
                <th>Inicio</th>
                <th>Etapa actual</th>
                <th>Área</th>
                <th>Avance</th>
                <th>Último mov.</th>
                <th style={{ textAlign: "right" }}>Días</th>
                <th>Estado</th>
                <th>Contrato obra</th>
                <th>Contrato mant.</th>
                <th>Siguiente paso</th>
                <th>Responsable NEB</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((e) => (
                <tr key={e.n}>
                  <td title={e.direccion}>{e.edificio}</td>
                  <td>{e.comuna || "–"}</td>
                  <td>{e.prospecto || "–"}</td>
                  <td>{fecha(e.inicio)}</td>
                  <td>{e.etapa ? `${e.paso}. ${e.etapa}` : "–"}</td>
                  <td>{e.area || "–"}</td>
                  <td><Barra v={e.avance} /></td>
                  <td>{fecha(e.ultimoMov)}</td>
                  <td style={{ textAlign: "right" }}>{e.dias ?? "–"}</td>
                  <td><EstadoBadge estado={e.estado} /></td>
                  <td><Firma v={e.contratoObra} /></td>
                  <td><Firma v={e.contratoMant} /></td>
                  <td>{e.siguiente || "–"}</td>
                  <td>{e.responsable || "–"}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 220 }}>{e.observaciones || "–"}</td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr><td colSpan={15} style={{ textAlign: "center" }}>Sin edificios con este estado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Resumen({ d }: { d: SeguimientoData }) {
  const r = d.resumen;
  return (
    <>
      <div className="stats">
        <Kpi v={String(r.total)} l="Edificios en seguimiento" />
        <Kpi v={String(r.enCurso)} l="En curso" color={ESTADO_COLOR["En curso"]} />
        <Kpi v={String(r.atrasados)} l="Atrasados" color={r.atrasados ? ESTADO_COLOR.Atrasado : undefined} />
        <Kpi v={String(r.enRechazo)} l="En rechazo / reingreso" color={r.enRechazo ? ESTADO_COLOR["En rechazo"] : undefined} />
        <Kpi v={String(r.completos)} l="Proceso completo" color={ESTADO_COLOR.Completo} />
        <Kpi v={pct(r.avancePromedio)} l="Avance promedio" />
        <Kpi v={String(r.ambosFirmados)} l="Con ambos contratos firmados" />
      </div>
      <div className="rct-grid">
        <Panel title="Edificios por etapa" hint="Solo se listan las etapas con al menos un edificio.">
          <HBars
            items={d.porEtapa.filter((e) => e.n > 0).map((e) => ({ label: `${e.paso}. ${e.etapa}`, value: e.n }))}
            format={(n) => String(n)}
          />
        </Panel>
        <Panel title="Edificios por área responsable" hint="Procesos en curso (sin los completos).">
          <HBars items={d.porArea.map((a) => ({ label: a.area, value: a.n }))} format={(n) => String(n)} />
        </Panel>
      </div>
    </>
  );
}

function Etapas({ d }: { d: SeguimientoData }) {
  return (
    <section className="summary">
      <h2>Etapas del proceso de contratos</h2>
      <p className="hint">Tabla de referencia de la planilla. Una etapa se marca «Atrasada» si el edificio lleva más de {d.diasMaxEtapa} días en ella.</p>
      <div className="table-scroll">
        <table className="data-table flujo-table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>N° en diagrama</th>
              <th>Etapa</th>
              <th>Área responsable</th>
              <th>Tipo</th>
              <th>Avance</th>
              <th>Siguiente paso</th>
              <th style={{ textAlign: "right" }}>Edificios</th>
            </tr>
          </thead>
          <tbody>
            {d.etapas.map((e, i) => (
              <tr key={e.orden}>
                <td>{e.orden}</td>
                <td>{e.paso}</td>
                <td>{e.etapa}</td>
                <td>{e.area}</td>
                <td>{e.tipo}</td>
                <td><Barra v={e.avance} /></td>
                <td>{e.siguiente}</td>
                <td style={{ textAlign: "right", fontWeight: 650 }}>{d.porEtapa[i]?.n || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ───────────── Página ───────────── */
export default function SeguimientoContratosDashboard({ data, error, generatedAt }: { data: SeguimientoData | null; error: string | null; generatedAt: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("seguimiento");

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="seguimiento" />
        <header className="page-head">
          <h1>Seguimiento de Contratos</h1>
          <p className="sub">Avance del proceso de contratos por edificio: etapa actual, área responsable, días en la etapa y estado</p>
          <div className="meta">
            {data && (
              <>
                <span>{data.resumen.total} edificios</span>
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

        {error || !data ? (
          <div className="error-box" style={{ marginTop: 20 }}>
            <strong>Error:</strong> {error ?? "Sin datos"}
          </div>
        ) : (
          <>
            <div className="rct-tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "seguimiento" && <Seguimiento d={data} />}
            {tab === "resumen" && <Resumen d={data} />}
            {tab === "etapas" && <Etapas d={data} />}

            <footer className="note">
              <strong>Sobre esta página:</strong> lee el Excel «Seguimiento de contratos por edificio» (Drive), hojas Seguimiento, Resumen y Etapas. Se digitan etapa, fechas y contratos en el
              Excel; el avance, los días en la etapa, el estado y los totales se calculan aquí con las mismas reglas de la planilla. Los datos se refrescan cada 10 minutos.
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
