"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Observacion } from "@/lib/parseObservaciones";
import TopNav from "./TopNav";
import "../app/dashboard.css";

const MONTH_ABBR_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTH_ABBR_ES[m - 1]} ${y}`;
}

function StatusChip({ label, kind }: { label: string; kind: "good" | "warning" | "critical" | "muted" }) {
  return <span className={`status-chip ${kind}`}>{label}</span>;
}

function estadoChip(v: string | null) {
  const up = (v ?? "").toUpperCase();
  if (up === "RESUELTA") return <StatusChip label="Resuelta" kind="good" />;
  if (up === "VERIFICADA") return <StatusChip label="Verificada" kind="good" />;
  if (up === "EN PROCESO") return <StatusChip label="En proceso" kind="warning" />;
  if (up === "PENDIENTE") return <StatusChip label="Pendiente" kind="critical" />;
  return <StatusChip label="Sin dato" kind="muted" />;
}

function prioridadChip(v: string | null) {
  const up = (v ?? "").toUpperCase();
  if (up === "ALTA") return <StatusChip label="Alta" kind="critical" />;
  if (up === "MEDIA") return <StatusChip label="Media" kind="warning" />;
  if (up === "BAJA") return <StatusChip label="Baja" kind="good" />;
  return <StatusChip label="Sin dato" kind="muted" />;
}

const RESPONSABLES = ["Pablo", "Helmer", "Juan", "Constanza"];
const ESTADOS = ["Pendiente", "En proceso", "Resuelta", "Verificada"];

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function isResuelta(estado: string | null): boolean {
  const up = (estado ?? "").toUpperCase();
  return up === "RESUELTA" || up === "VERIFICADA";
}

export default function ObservacionesDashboard({
  observaciones,
  generatedAt,
  error,
}: {
  observaciones: Observacion[];
  generatedAt: string;
  error: string | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [onlyAtrasadas, setOnlyAtrasadas] = useState(false);
  const [responsableSel, setResponsableSel] = useState<string[]>([]);
  const [estadoSel, setEstadoSel] = useState<string[]>([]);

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const stats = useMemo(() => {
    const total = observaciones.length;
    const pendientes = observaciones.filter((o) => (o.estado ?? "").toUpperCase() === "PENDIENTE").length;
    const enProceso = observaciones.filter((o) => (o.estado ?? "").toUpperCase() === "EN PROCESO").length;
    const resueltas = observaciones.filter((o) => isResuelta(o.estado)).length;
    const atrasadas = observaciones.filter((o) => !isResuelta(o.estado) && o.diasAbiertos !== null && o.diasAbiertos > 15).length;
    return { total, pendientes, enProceso, resueltas, atrasadas };
  }, [observaciones]);

  if (error) {
    return (
      <div className="viz-root">
        <div className="wrap">
          <TopNav active="observaciones" />
          <header className="page-head">
            <h1>Seguimiento de Tareas</h1>
            <p className="sub">No se pudieron cargar los datos</p>
          </header>
          <div className="error-box" style={{ marginTop: 20 }}>
            <strong>Error:</strong> {error}
          </div>
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  let filtered = q
    ? observaciones.filter((o) =>
        (o.proyecto + " " + (o.descripcion ?? "") + " " + (o.responsable ?? "")).toLowerCase().includes(q)
      )
    : observaciones;
  if (responsableSel.length) {
    filtered = filtered.filter((o) => responsableSel.some((r) => (o.responsable ?? "").toLowerCase().includes(r.toLowerCase())));
  }
  if (estadoSel.length) {
    filtered = filtered.filter((o) => estadoSel.some((e) => (o.estado ?? "").toUpperCase() === e.toUpperCase()));
  }
  if (onlyAtrasadas) {
    filtered = filtered.filter((o) => !isResuelta(o.estado) && o.diasAbiertos !== null && o.diasAbiertos > 15);
  }

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="observaciones" />
        <header className="page-head">
          <h1>Seguimiento de Tareas</h1>
          <p className="sub">Observaciones de ITO, post-entrega y certificación por obra</p>
          <div className="meta">
            <span>
              Fuente: <strong style={{ color: "var(--text-secondary)" }}>Seguimiento_Observaciones RCT.xlsx</strong> (Google Drive)
            </span>
            <span className="dot" />
            <span>Actualizado en cada visita · última lectura {new Date(generatedAt).toLocaleString("es-CL")}</span>
            <span className="dot" />
            <button type="button" onClick={logout} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0 }}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
          <div className="stat-tile"><div className="v">{stats.total}</div><div className="l">Tareas totales</div></div>
          <div className="stat-tile"><div className="v">{stats.pendientes}</div><div className="l">Pendientes</div></div>
          <div className="stat-tile"><div className="v">{stats.enProceso}</div><div className="l">En proceso</div></div>
          <div className="stat-tile"><div className="v">{stats.resueltas}</div><div className="l">Resueltas / verificadas</div></div>
          <div className="stat-tile"><div className="v" style={{ color: stats.atrasadas > 0 ? "var(--status-critical)" : undefined }}>{stats.atrasadas}</div><div className="l">Atrasadas (&gt;15 días sin resolver)</div></div>
        </div>

        <section className="summary">
          <h2>Detalle de tareas</h2>
          <p className="hint">Busca por proyecto, descripción o responsable, o filtra por responsable y estado.</p>
          <div className="controls-row" style={{ marginBottom: 12 }}>
            <input
              className="search-box"
              style={{ marginBottom: 0 }}
              type="text"
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className={"chip" + (onlyAtrasadas ? " active" : "")}
              onClick={() => setOnlyAtrasadas((v) => !v)}
              type="button"
            >
              Solo atrasadas ({stats.atrasadas})
            </button>
          </div>
          <div className="controls-row" style={{ marginBottom: 8 }}>
            {RESPONSABLES.map((r) => (
              <button key={r} type="button" className={"chip" + (responsableSel.includes(r) ? " active" : "")} onClick={() => setResponsableSel(toggle(responsableSel, r))}>
                {r}
              </button>
            ))}
          </div>
          <div className="controls-row" style={{ marginBottom: 12 }}>
            {ESTADOS.map((e) => (
              <button key={e} type="button" className={"chip" + (estadoSel.includes(e) ? " active" : "")} onClick={() => setEstadoSel(toggle(estadoSel, e))}>
                {e}
              </button>
            ))}
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Proyecto</th>
                  <th>Origen</th>
                  <th>Fecha detección</th>
                  <th>Descripción</th>
                  <th>Responsable</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Compromiso</th>
                  <th>Resolución</th>
                  <th>Días abiertos</th>
                  <th>Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const atrasada = !isResuelta(o.estado) && o.diasAbiertos !== null && o.diasAbiertos > 15;
                  return (
                    <tr key={i}>
                      <td>{o.numero ?? "—"}</td>
                      <td className="obra-col">{o.proyecto}</td>
                      <td>{o.origen ?? "—"}</td>
                      <td>{fmtDate(o.fechaDeteccion)}</td>
                      <td className="wrap-col">{o.descripcion ?? "—"}</td>
                      <td>{o.responsable ?? "—"}</td>
                      <td>{prioridadChip(o.prioridad)}</td>
                      <td>{estadoChip(o.estado)}</td>
                      <td>{fmtDate(o.fechaCompromiso)}</td>
                      <td>{fmtDate(o.fechaResolucion)}</td>
                      <td style={{ color: atrasada ? "var(--status-critical)" : undefined, fontWeight: atrasada ? 700 : undefined }}>
                        {o.diasAbiertos ?? "—"}
                      </td>
                      <td className="wrap-col">{o.comentarios ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="note">
          <strong>Sobre esta página:</strong> los datos se leen directamente desde el archivo en Google Drive cada vez
          que alguien la visita. Esta página requiere contraseña porque contiene observaciones internas de obra.
        </footer>
      </div>
    </div>
  );
}
