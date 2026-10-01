"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PASOS, type GrupoPaso, type ProyectoCertificacion, type RechazoSeremi } from "@/lib/parseCertificacion";
import TopNav from "./TopNav";
import "../app/dashboard.css";

type Kind = "good" | "warning" | "critical" | "info" | "muted";

const GRUPOS: { id: GrupoPaso; label: string }[] = [
  { id: "SEC", label: "Documentos SEC" },
  { id: "SEREMI", label: "SEREMI" },
  { id: "Metrogas", label: "Cartas Metrogas" },
];

const KIND_COLOR: Record<Kind, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
  info: "var(--accent)",
  muted: "var(--baseline)",
};

function StatusChip({ label, kind }: { label: string; kind: Kind }) {
  return <span className={`status-chip ${kind}`}>{label}</span>;
}

function estadoKind(v: string | null): Kind {
  if (!v) return "muted";
  if (v.includes("🟢") || v.includes("✅") || /aprobado/i.test(v)) return "good";
  if (v.includes("🟡")) return "warning";
  if (v.includes("🔴")) return "critical";
  if (v.includes("🔵")) return "info";
  return "muted";
}

function estadoChip(v: string | null) {
  return <StatusChip label={v ?? "Sin dato"} kind={estadoKind(v)} />;
}

type Sym = "ok" | "wip" | "bad" | "na" | "pend";

function symKind(v: string | null): Sym {
  if (v === "✓") return "ok";
  if (v === "⏳") return "wip";
  if (v === "✗") return "bad";
  if (v === "—") return "na";
  return "pend";
}

function symbolCell(v: string | null) {
  const k = symKind(v);
  return (
    <td className={`sym sym-${k}`} title={k === "pend" ? "Pendiente" : undefined}>
      {k === "pend" ? "·" : v}
    </td>
  );
}

function avanceColor(pct: number) {
  return pct >= 0.85 ? "var(--status-good)" : pct >= 0.4 ? "var(--accent)" : "var(--status-warning)";
}

function Donut({ slices, center, label }: { slices: { label: string; value: number; color: string }[]; center: string; label: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 52;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" role="img" aria-label={`${label}: ${center}`} className="donut">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="20" />
        {slices
          .filter((x) => x.value > 0)
          .map((x) => {
            const len = (x.value / total) * C;
            const el = (
              <circle
                key={x.label}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={x.color}
                strokeWidth="20"
                strokeDasharray={`${Math.max(len - 1.5, 0)} ${C}`}
                strokeDashoffset={-acc}
                transform="rotate(-90 70 70)"
              >
                <title>{`${x.label}: ${x.value}`}</title>
              </circle>
            );
            acc += len;
            return el;
          })}
        <text x="70" y="68" textAnchor="middle" className="donut-v">{center}</text>
        <text x="70" y="86" textAnchor="middle" className="donut-l">{label}</text>
      </svg>
      <ul className="donut-legend">
        {slices.map((x) => (
          <li key={x.label}>
            <i style={{ background: x.color }} />
            <span>{x.label}</span>
            <b>{x.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
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
    const aprobados = proyectos.filter((p) => estadoKind(p.estadoGeneral) === "good").length;
    const conObservaciones = proyectos.filter((p) => p.aprobacionSeremi === "✗").length;
    const rechazosActivos = rechazos.filter((r) => estadoKind(r.estado) !== "good").length;
    return { total, avgPct, cartasCompletas, aprobados, conObservaciones, rechazosActivos };
  }, [proyectos, rechazos]);

  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    proyectos.forEach((p) => {
      const key = p.estadoGeneral ?? "⚪ Sin iniciar";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [proyectos]);

  const rechazoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rechazos.forEach((r) => {
      const key = r.estado ?? "Sin estado";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rechazos]);

  const pasoStats = useMemo(
    () =>
      PASOS.map((paso) => {
        const c = { ok: 0, wip: 0, bad: 0, na: 0, pend: 0 };
        proyectos.forEach((p) => {
          c[symKind(p[paso.key])]++;
        });
        return { ...paso, ...c };
      }),
    [proyectos]
  );

  const grupoStats = useMemo(
    () =>
      GRUPOS.map((g) => {
        const pasos = PASOS.filter((x) => x.grupo === g.id);
        const done = proyectos.reduce((s, p) => s + pasos.filter((x) => p[x.key] === "✓").length, 0);
        const max = pasos.length * proyectos.length || 1;
        return { ...g, pct: done / max, pasos: pasos.length };
      }),
    [proyectos]
  );

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
          <div className="stat-tile"><div className="v" style={{ color: "var(--status-good)" }}>{stats.aprobados}</div><div className="l">Proyectos aprobados</div></div>
          <div className="stat-tile"><div className="v">{stats.cartasCompletas}</div><div className="l">Con cartas 35% y 15% firmadas</div></div>
          <div className="stat-tile"><div className="v" style={{ color: stats.conObservaciones > 0 ? "var(--status-warning)" : undefined }}>{stats.conObservaciones}</div><div className="l">Con observaciones SEREMI</div></div>
          <div className="stat-tile"><div className="v" style={{ color: stats.rechazosActivos > 0 ? "var(--status-critical)" : undefined }}>{stats.rechazosActivos}</div><div className="l">Rechazos SEREMI activos</div></div>
        </div>

        <div className="two-col" style={{ marginTop: 16 }}>
          <section className="summary" style={{ marginTop: 0 }}>
            <h2>Estado general</h2>
            <p className="hint">Situación resumida asignada a cada proyecto.</p>
            <Donut
              label="proyectos"
              center={String(stats.total)}
              slices={estadoCounts.map(([label, value]) => ({ label, value, color: KIND_COLOR[estadoKind(label)] }))}
            />
          </section>

          <section className="summary" style={{ marginTop: 0 }}>
            <h2>Avance por área</h2>
            <p className="hint">Pasos completados (✓) sobre el total posible de todos los proyectos.</p>
            <div className="group-rings">
              {grupoStats.map((g) => {
                const circ = 2 * Math.PI * 32;
                return (
                  <div className="ring" key={g.id}>
                    <svg viewBox="0 0 80 80" role="img" aria-label={`${g.label} ${Math.round(g.pct * 100)}%`}>
                      <circle cx="40" cy="40" r="32" fill="none" stroke="var(--surface-2)" strokeWidth="9" />
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        fill="none"
                        strokeWidth="9"
                        strokeLinecap="round"
                        stroke={avanceColor(g.pct)}
                        strokeDasharray={`${g.pct * circ} ${circ}`}
                        transform="rotate(-90 40 40)"
                      />
                      <text x="40" y="45" textAnchor="middle" className="ring-v">{Math.round(g.pct * 100)}%</text>
                    </svg>
                    <div className="ring-l"><strong>{g.label}</strong><span>{g.pasos} pasos</span></div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="summary">
          <h2>Avance de certificación por proyecto</h2>
          <p className="hint">Porcentaje de pasos completados (documentos SEC, SEREMI y cartas Metrogas).</p>
          <div>
            {porAvance.map((p) => (
              <div className="bar-row" key={p.proyecto}>
                <div className="lbl">{p.proyecto}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${p.pctAvance * 100}%`, background: avanceColor(p.pctAvance) }} />
                </div>
                <div className="n">{Math.round(p.pctAvance * 100)}%</div>
              </div>
            ))}
          </div>
        </section>

        <section className="summary">
          <h2>Cumplimiento por paso</h2>
          <p className="hint">Cuántos proyectos están en cada estado en cada paso de la certificación.</p>
          <div className="step-legend">
            <span><i className="s-ok" />Completo</span>
            <span><i className="s-wip" />En proceso</span>
            <span><i className="s-bad" />Rechazado / con observaciones</span>
            <span><i className="s-pend" />Pendiente</span>
            <span><i className="s-na" />No aplica</span>
          </div>
          {GRUPOS.map((g) => (
            <div key={g.id} className="step-group">
              <div className="step-group-title">{g.label}</div>
              {pasoStats
                .filter((x) => x.grupo === g.id)
                .map((x) => {
                  const tot = proyectos.length || 1;
                  return (
                    <div className="step-row" key={x.key}>
                      <div className="lbl">{x.label}</div>
                      <div className="step-track" title={`✓ ${x.ok} · ⏳ ${x.wip} · ✗ ${x.bad} · pendiente ${x.pend} · no aplica ${x.na}`}>
                        <div className="s-ok" style={{ width: `${(x.ok / tot) * 100}%` }} />
                        <div className="s-wip" style={{ width: `${(x.wip / tot) * 100}%` }} />
                        <div className="s-bad" style={{ width: `${(x.bad / tot) * 100}%` }} />
                        <div className="s-pend" style={{ width: `${(x.pend / tot) * 100}%` }} />
                        <div className="s-na" style={{ width: `${(x.na / tot) * 100}%` }} />
                      </div>
                      <div className="n">{x.ok}/{proyectos.length}</div>
                    </div>
                  );
                })}
            </div>
          ))}
        </section>

        <section className="summary">
          <h2>Detalle de certificación por proyecto</h2>
          <p className="hint">Estado de cada paso: documentos SEC, SEREMI y cartas Metrogas.</p>
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
                <tr className="grp-row">
                  <th colSpan={2} />
                  <th colSpan={9} className="grp-sec">Documentos SEC</th>
                  <th colSpan={5} className="grp-seremi">SEREMI</th>
                  <th colSpan={4} className="grp-metrogas">Cartas Metrogas</th>
                  <th colSpan={2} />
                </tr>
                <tr>
                  <th>Proyecto</th>
                  <th>Contrato</th>
                  {PASOS.map((x) => (
                    <th key={x.key}>{x.label}</th>
                  ))}
                  <th>Fecha / nota carta</th>
                  <th>Avance</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.proyecto}>
                    <td className="obra-col">{p.proyecto}</td>
                    <td>{p.contrato ?? "—"}</td>
                    {PASOS.map((x) => (
                      <Fragment key={x.key}>{symbolCell(p[x.key])}</Fragment>
                    ))}
                    <td className="wrap-col">{p.fechaCarta ?? "—"}</td>
                    <td>
                      <div className="mini-bar"><div style={{ width: `${p.pctAvance * 100}%`, background: avanceColor(p.pctAvance) }} /></div>
                      {Math.round(p.pctAvance * 100)}%
                    </td>
                    <td>{estadoChip(p.estadoGeneral ?? "⚪ Sin iniciar")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="summary">
          <h2>Rechazos SEREMI</h2>
          <p className="hint">Inspecciones rechazadas y su plan de reingreso.</p>
          {rechazoCounts.length > 0 && (
            <div className="rechazo-chips">
              {rechazoCounts.map(([label, count]) => (
                <span key={label} className="rechazo-chip" style={{ borderColor: KIND_COLOR[estadoKind(label)] }}>
                  <i style={{ background: KIND_COLOR[estadoKind(label)] }} />
                  {label}
                  <b>{count}</b>
                </span>
              ))}
            </div>
          )}
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
          que alguien la visita. El % de avance se calcula sobre los 17 pasos de documentos SEC, SEREMI y cartas
          Metrogas del proyecto (✓ completados / 17), por lo que puede diferir del % que muestra la planilla.
        </footer>
      </div>
    </div>
  );
}
