"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProyectoCertificacion, RechazoSeremi } from "@/lib/parseCertificacion";
import TopNav from "./TopNav";
import "../app/dashboard.css";

function StatusChip({ label, kind }: { label: string; kind: "good" | "warning" | "critical" | "info" | "muted" }) {
  return <span className={`status-chip ${kind}`}>{label}</span>;
}

function estadoKind(v: string | null): "good" | "warning" | "critical" | "info" | "muted" {
  if (!v) return "muted";
  if (v.includes("🟢")) return "good";
  if (v.includes("🟡")) return "warning";
  if (v.includes("🔴")) return "critical";
  if (v.includes("🔵")) return "info";
  return "muted";
}

function estadoChip(v: string | null) {
  return <StatusChip label={v ?? "Sin dato"} kind={estadoKind(v)} />;
}

function symbolCell(v: string | null) {
  if (v === "✓") return <span style={{ color: "var(--status-good)", fontWeight: 700 }}>✓</span>;
  if (v === "⏳") return <span style={{ color: "var(--status-warning)", fontWeight: 700 }}>⏳</span>;
  if (v === "✗") return <span style={{ color: "var(--status-critical)", fontWeight: 700 }}>✗</span>;
  if (v === "—") return <span style={{ color: "var(--muted)" }}>—</span>;
  return <span style={{ color: "var(--muted)" }}>·</span>;
}

export default function CertificacionDashboard({
  proyectos,
  rechazos,
  generatedAt,
  error,
}: {
  proyectos: ProyectoCertificacion[];
  rechazos: RechazoSeremi[];
  generatedAt: string;
  error: string | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const stats = useMemo(() => {
    const total = proyectos.length;
    const avgPct = total > 0 ? Math.round((proyectos.reduce((s, p) => s + p.pctAvance, 0) / total) * 100) : 0;
    const cartasCompletas = proyectos.filter((p) => p.carta35 === "✓" && p.carta15 === "✓").length;
    const rechazosActivos = rechazos.filter((r) => !(r.estado ?? "").includes("🟢")).length;
    return { total, avgPct, cartasCompletas, rechazosActivos };
  }, [proyectos, rechazos]);

  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    proyectos.forEach((p) => {
      const key = p.estadoGeneral ?? "Sin dato";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [proyectos]);

  if (error) {
    return (
      <div className="viz-root">
        <div className="wrap">
          <TopNav active="certificacion" />
          <header className="page-head">
            <h1>Certificación de Refacciones</h1>
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
  const filtered = q ? proyectos.filter((p) => p.proyecto.toLowerCase().includes(q)) : proyectos;

  const porAvance = [...proyectos].sort((a, b) => b.pctAvance - a.pctAvance);
  const maxEstado = Math.max(...estadoCounts.map(([, c]) => c), 1);

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="certificacion" />
        <header className="page-head">
          <h1>Certificación de Refacciones</h1>
          <p className="sub">Seguimiento de certificación SEC/SEREMI y rechazos por obra</p>
          <div className="meta">
            <span>
              Fuente: <strong style={{ color: "var(--text-secondary)" }}>Certificacion_Refacciones_v2.xlsx</strong> (Google Drive)
            </span>
            <span className="dot" />
            <span>Actualizado en cada visita · última lectura {new Date(generatedAt).toLocaleString("es-CL")}</span>
            <span className="dot" />
            <button type="button" onClick={logout} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0 }}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <div className="stats">
          <div className="stat-tile"><div className="v">{stats.total}</div><div className="l">Proyectos en certificación</div></div>
          <div className="stat-tile"><div className="v">{stats.avgPct}%</div><div className="l">Avance promedio</div></div>
          <div className="stat-tile"><div className="v">{stats.cartasCompletas}</div><div className="l">Con cartas 35% y 15% completas</div></div>
          <div className="stat-tile"><div className="v" style={{ color: stats.rechazosActivos > 0 ? "var(--status-critical)" : undefined }}>{stats.rechazosActivos}</div><div className="l">Rechazos SEREMI activos</div></div>
        </div>

        <section className="summary">
          <h2>Avance de certificación por proyecto</h2>
          <p className="hint">Porcentaje de pasos completados (documentos SEC, SEREMI y cartas Metrogas).</p>
          <div>
            {porAvance.map((p) => (
              <div className="bar-row" key={p.proyecto}>
                <div className="lbl">{p.proyecto}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${p.pctAvance * 100}%`,
                      background: p.pctAvance >= 0.85 ? "var(--status-good)" : p.pctAvance >= 0.4 ? "var(--accent)" : "var(--status-warning)",
                    }}
                  />
                </div>
                <div className="n">{Math.round(p.pctAvance * 100)}%</div>
              </div>
            ))}
          </div>
        </section>

        <section className="summary">
          <h2>Estado general</h2>
          <p className="hint">Situación resumida asignada a cada proyecto.</p>
          <div className="status-bar-list">
            {estadoCounts.map(([label, count]) => (
              <div className="bar-row" key={label}>
                <div className="lbl">{label}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(count / maxEstado) * 100}%`,
                      background:
                        estadoKind(label) === "good" ? "var(--status-good)" :
                        estadoKind(label) === "warning" ? "var(--status-warning)" :
                        estadoKind(label) === "critical" ? "var(--status-critical)" :
                        estadoKind(label) === "info" ? "var(--accent)" : "var(--muted)",
                    }}
                  />
                </div>
                <div className="n">{count}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="summary">
          <h2>Detalle de certificación por proyecto</h2>
          <p className="hint">Estado de cada paso: documentos SEC, inspecciones SEREMI y cartas Metrogas.</p>
          <input
            className="search-box"
            type="text"
            placeholder="Buscar proyecto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Contrato</th>
                  <th>1° Visita</th>
                  <th>Informe</th>
                  <th>2° Visita</th>
                  <th>Sello Verde</th>
                  <th>Informe TC5</th>
                  <th>TC5</th>
                  <th>TE1</th>
                  <th>Operador</th>
                  <th>1° Insp. SEREMI</th>
                  <th>2° Insp. SEREMI</th>
                  <th>Inscrito SEREMI</th>
                  <th>Carta 35%</th>
                  <th>Carta 15%</th>
                  <th>Avance</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.proyecto}>
                    <td className="obra-col">{p.proyecto}</td>
                    <td>{p.contrato ?? "—"}</td>
                    <td>{symbolCell(p.primeraVisita)}</td>
                    <td>{symbolCell(p.informe)}</td>
                    <td>{symbolCell(p.segundaVisita)}</td>
                    <td>{symbolCell(p.selloVerde)}</td>
                    <td>{symbolCell(p.informeTC5)}</td>
                    <td>{symbolCell(p.tc5)}</td>
                    <td>{symbolCell(p.te1)}</td>
                    <td>{symbolCell(p.operador)}</td>
                    <td>{symbolCell(p.primeraInspeccionSeremi)}</td>
                    <td>{symbolCell(p.segundaInspeccionSeremi)}</td>
                    <td>{symbolCell(p.inscritoSeremi)}</td>
                    <td>{symbolCell(p.carta35)}</td>
                    <td>{symbolCell(p.carta15)}</td>
                    <td>{Math.round(p.pctAvance * 100)}%</td>
                    <td>{estadoChip(p.estadoGeneral)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="summary">
          <h2>Rechazos SEREMI</h2>
          <p className="hint">Inspecciones rechazadas y su plan de reingreso.</p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Edificio</th>
                  <th>Código RCTA</th>
                  <th>Fecha rechazo</th>
                  <th>Razón del rechazo</th>
                  <th>Estado</th>
                  <th>Plan de acción</th>
                  <th>Fecha reingreso</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {rechazos.map((r, i) => (
                  <tr key={i}>
                    <td className="obra-col">{r.edificio}</td>
                    <td>{r.codigoRcta ?? "—"}</td>
                    <td>{r.fechaRechazo ?? "—"}</td>
                    <td className="wrap-col">{r.razon ?? "—"}</td>
                    <td>{estadoChip(r.estado)}{r.notaAdicional ? ` · ${r.notaAdicional}` : ""}</td>
                    <td className="wrap-col">{r.planAccion ?? "—"}</td>
                    <td>{r.fechaReingreso ?? "—"}</td>
                    <td>{r.responsable ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="note">
          <strong>Sobre esta página:</strong> los datos se leen directamente desde el archivo en Google Drive cada vez
          que alguien la visita. El % de avance se calcula sobre los 13 pasos de documentos SEC, SEREMI y cartas
          Metrogas del proyecto.
        </footer>
      </div>
    </div>
  );
}
