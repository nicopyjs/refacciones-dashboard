"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SeccionData } from "@/lib/parseIngenieriaEntrega";
import { avanceColor, symKind, symbolCell } from "./CertificacionDashboard";
import TopNav from "./TopNav";
import "../app/dashboard.css";

const GRP_CLASS = ["grp-sec", "grp-seremi", "grp-metrogas"];

function Seccion({ data }: { data: SeccionData }) {
  const [search, setSearch] = useState("");
  const [showSinAvance, setShowSinAvance] = useState(false);
  const [showCompletos, setShowCompletos] = useState(true);

  const { filas, pasosDef, infoLabels } = data;

  const stats = useMemo(() => {
    const total = filas.length;
    const avg = total ? Math.round((filas.reduce((s, f) => s + f.pctAvance, 0) / total) * 100) : 0;
    const completos = filas.filter((f) => f.pctAvance >= 0.999).length;
    const sinAvance = filas.filter((f) => f.pctAvance === 0).length;
    const enCurso = total - completos - sinAvance;
    return { total, avg, completos, sinAvance, enCurso };
  }, [filas]);

  // Contiguous runs of steps sharing a group → header cells.
  const grupos = useMemo(() => {
    const out: { label: string; span: number }[] = [];
    pasosDef.forEach((p) => {
      const last = out[out.length - 1];
      if (last && last.label === p.grupo) last.span++;
      else out.push({ label: p.grupo, span: 1 });
    });
    return out;
  }, [pasosDef]);

  const pasoStats = useMemo(
    () =>
      pasosDef.map((p, i) => {
        const c = { ok: 0, wip: 0, bad: 0, na: 0, pend: 0 };
        filas.forEach((f) => {
          c[symKind(f.pasos[i])]++;
        });
        return { ...p, ...c };
      }),
    [filas, pasosDef]
  );

  const q = search.trim().toLowerCase();
  const matches = filas.filter((f) => {
    if (!q) return true;
    return f.proyecto.toLowerCase().includes(q) || f.info.some((x) => x?.toLowerCase().includes(q));
  });
  const sinAvance = matches.filter((f) => f.pctAvance === 0);
  const visibles = matches.filter((f) => (showSinAvance || f.pctAvance > 0) && (showCompletos || f.pctAvance < 0.999));
  const sinAvanceOculto = !showSinAvance && sinAvance.length > 0;
  const porAvance = [...filas].filter((f) => f.pctAvance > 0).sort((a, b) => b.pctAvance - a.pctAvance);
  const colSpan = 1 + infoLabels.length + pasosDef.length + 2;

  return (
    <>
      <section className="summary">
        <h2>{data.titulo}</h2>
        <p className="hint">{data.descripcion}</p>
        <div className="stats">
          <div className="stat-tile"><div className="v">{stats.total}</div><div className="l">Proyectos</div></div>
          <div className="stat-tile"><div className="v">{stats.avg}%</div><div className="l">Avance promedio</div></div>
          <div className="stat-tile"><div className="v" style={{ color: "var(--status-good)" }}>{stats.completos}</div><div className="l">Completos (100%)</div></div>
          <div className="stat-tile"><div className="v">{stats.enCurso}</div><div className="l">En curso</div></div>
          <div className="stat-tile"><div className="v">{stats.sinAvance}</div><div className="l">Sin avance</div></div>
        </div>
      </section>

      <section className="summary">
        <h2>Avance por proyecto — {data.titulo}</h2>
        <p className="hint">Porcentaje de pasos completados (✓) sobre los {pasosDef.length} pasos. Solo proyectos con avance.</p>
        <div>
          {porAvance.map((f) => (
            <div className="bar-row" key={f.proyecto}>
              <div className="lbl">{f.proyecto}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${f.pctAvance * 100}%`, background: avanceColor(f.pctAvance) }} />
              </div>
              <div className="n">{Math.round(f.pctAvance * 100)}%</div>
            </div>
          ))}
          {porAvance.length === 0 && <p className="hint">Ningún proyecto tiene avance todavía.</p>}
        </div>
      </section>

      <section className="summary">
        <h2>Cumplimiento por paso — {data.titulo}</h2>
        <p className="hint">Cuántos proyectos están en cada estado en cada paso.</p>
        <div className="step-legend">
          <span><i className="s-ok" />Completo</span>
          <span><i className="s-wip" />En proceso</span>
          <span><i className="s-bad" />Rechazado / con observaciones</span>
          <span><i className="s-pend" />Pendiente</span>
          <span><i className="s-na" />No aplica</span>
        </div>
        {grupos.map((g) => (
          <div key={g.label} className="step-group">
            <div className="step-group-title">{g.label}</div>
            {pasoStats
              .filter((x) => x.grupo === g.label)
              .map((x) => {
                const tot = filas.length || 1;
                return (
                  <div className="step-row" key={x.label}>
                    <div className="lbl">{x.label}</div>
                    <div className="step-track" title={`✓ ${x.ok} · ⏳ ${x.wip} · ✗ ${x.bad} · pendiente ${x.pend} · no aplica ${x.na}`}>
                      <div className="s-ok" style={{ width: `${(x.ok / tot) * 100}%` }} />
                      <div className="s-wip" style={{ width: `${(x.wip / tot) * 100}%` }} />
                      <div className="s-bad" style={{ width: `${(x.bad / tot) * 100}%` }} />
                      <div className="s-pend" style={{ width: `${(x.pend / tot) * 100}%` }} />
                      <div className="s-na" style={{ width: `${(x.na / tot) * 100}%` }} />
                    </div>
                    <div className="n">{x.ok}/{filas.length}</div>
                  </div>
                );
              })}
          </div>
        ))}
      </section>

      <section className="summary">
        <h2>Detalle por proyecto — {data.titulo}</h2>
        <p className="hint">Estado de cada paso. Pasa el mouse sobre un ✓ para ver la fecha, si la planilla la tiene.</p>
        <div className="filter-bar">
          <input
            className="search-box"
            type="text"
            placeholder="Buscar proyecto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="filter-check">
            <input type="checkbox" checked={showSinAvance} onChange={(e) => setShowSinAvance(e.target.checked)} />
            Mostrar proyectos sin avance
          </label>
          <label className="filter-check">
            <input type="checkbox" checked={showCompletos} onChange={(e) => setShowCompletos(e.target.checked)} />
            Mostrar proyectos completos
          </label>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr className="grp-row">
                <th colSpan={1 + infoLabels.length} />
                {grupos.map((g, i) => (
                  <th key={g.label} colSpan={g.span} className={GRP_CLASS[i % GRP_CLASS.length]}>{g.label}</th>
                ))}
                <th colSpan={2} />
              </tr>
              <tr>
                <th>Proyecto</th>
                {infoLabels.map((l) => (
                  <th key={l}>{l}</th>
                ))}
                {pasosDef.map((p) => (
                  <th key={p.label}>{p.label}</th>
                ))}
                <th>Avance</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.proyecto}>
                  <td className="obra-col">{f.proyecto}</td>
                  {f.info.map((x, i) => (
                    <td key={i} className="wrap-col">{x ?? "—"}</td>
                  ))}
                  {f.pasos.map((v, i) => (
                    <Fragment key={i}>{symbolCell(v, f.fechas[i])}</Fragment>
                  ))}
                  <td>
                    <div className="mini-bar"><div style={{ width: `${f.pctAvance * 100}%`, background: avanceColor(f.pctAvance) }} /></div>
                    {Math.round(f.pctAvance * 100)}%
                  </td>
                  <td className="wrap-col">{f.comentario ?? "—"}</td>
                </tr>
              ))}
              {sinAvanceOculto && (
                <tr className="collapsed-row">
                  <td colSpan={colSpan}>
                    <button type="button" className="collapsed-btn" onClick={() => setShowSinAvance(true)}>
                      ▸ {sinAvance.length} proyecto{sinAvance.length === 1 ? "" : "s"} sin avance (ocultos) — mostrar
                    </button>
                    <span className="collapsed-names">{sinAvance.map((f) => f.proyecto).join(" · ")}</span>
                  </td>
                </tr>
              )}
              {visibles.length === 0 && !sinAvanceOculto && (
                <tr><td colSpan={colSpan} className="wrap-col">Ningún proyecto coincide con los filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default function IngenieriaEntregaDashboard({
  ingenieria,
  entrega,
  generatedAt,
  error,
}: {
  ingenieria: SeccionData | null;
  entrega: SeccionData | null;
  generatedAt: string;
  error: string | null;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  if (error || !ingenieria || !entrega) {
    return (
      <div className="viz-root">
        <div className="wrap">
          <TopNav active="ingenieria" />
          <header className="page-head">
            <h1>Ingeniería y Entrega</h1>
            <p className="sub">No se pudieron cargar los datos</p>
          </header>
          <div className="error-box" style={{ marginTop: 20 }}>
            <strong>Error:</strong> {error ?? "Sin datos."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="ingenieria" />
        <header className="page-head">
          <h1>Ingeniería y Entrega</h1>
          <p className="sub">Seguimiento de ingeniería y de entrega / puesta en régimen por obra</p>
          <div className="meta">
            <span>
              Fuente: <strong style={{ color: "var(--text-secondary)" }}>Certificacion_Refacciones_v2.xlsx</strong> (Google Drive), hojas «Ingenieria» y «Entrega»
            </span>
            <span className="dot" />
            <span>Actualizado en cada visita · última lectura {new Date(generatedAt).toLocaleString("es-CL")}</span>
            <span className="dot" />
            <button type="button" onClick={logout} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0 }}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <Seccion data={ingenieria} />
        <Seccion data={entrega} />

        <footer className="note">
          <strong>Sobre esta página:</strong> los datos se leen directamente desde el archivo en Google Drive cada vez
          que alguien la visita. El % de avance es ✓ completados sobre el total de pasos de cada hoja; un paso con «—»
          (no aplica) o vacío (pendiente) no suma.
        </footer>
      </div>
    </div>
  );
}
