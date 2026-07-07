"use client";

import { useMemo, useState } from "react";
import type { ObraEntrega, ObraEspecificacion } from "@/lib/parseRefacciones";
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

function entregadoChip(v: boolean | null) {
  if (v === true) return <StatusChip label="Entregado" kind="good" />;
  if (v === false) return <StatusChip label="Pendiente" kind="warning" />;
  return <StatusChip label="Sin dato" kind="muted" />;
}

function seremiChip(v: string | null) {
  const up = (v ?? "").toUpperCase();
  if (up === "APROBADO") return <StatusChip label="Aprobado" kind="good" />;
  if (up === "PENDIENTE") return <StatusChip label="Pendiente" kind="warning" />;
  if (up === "RECHAZADO") return <StatusChip label="Rechazado" kind="critical" />;
  return <StatusChip label="Sin dato" kind="muted" />;
}

function capacitacionChip(v: string | null) {
  const up = (v ?? "").toUpperCase();
  if (up === "SI" || up === "SÍ") return <StatusChip label="Sí" kind="good" />;
  if (up === "NO") return <StatusChip label="No" kind="warning" />;
  return <StatusChip label="Sin dato" kind="muted" />;
}

export default function GestionDashboard({
  obras,
  especificaciones,
  generatedAt,
  error,
}: {
  obras: ObraEntrega[];
  especificaciones: ObraEspecificacion[];
  generatedAt: string;
  error: string | null;
}) {
  const [obraSearch, setObraSearch] = useState("");
  const [specSearch, setSpecSearch] = useState("");

  const stats = useMemo(() => {
    const total = obras.length;
    const entregadas = obras.filter((o) => o.entregado === true).length;
    const pendientes = obras.filter((o) => o.entregado === false).length;
    const pct = total > 0 ? Math.round((entregadas / total) * 100) : 0;
    return { total, entregadas, pendientes, pct };
  }, [obras]);

  const seremiCounts = useMemo(() => {
    const counts: Record<string, number> = { Aprobado: 0, Pendiente: 0, Rechazado: 0, "Sin dato": 0 };
    obras.forEach((o) => {
      const up = (o.seremi ?? "").toUpperCase();
      if (up === "APROBADO") counts["Aprobado"]++;
      else if (up === "PENDIENTE") counts["Pendiente"]++;
      else if (up === "RECHAZADO") counts["Rechazado"]++;
      else counts["Sin dato"]++;
    });
    return counts;
  }, [obras]);

  const capacitacionCounts = useMemo(() => {
    const counts: Record<string, number> = { Sí: 0, No: 0, "Sin dato": 0 };
    obras.forEach((o) => {
      const up = (o.capacitacion ?? "").toUpperCase();
      if (up === "SI" || up === "SÍ") counts["Sí"]++;
      else if (up === "NO") counts["No"]++;
      else counts["Sin dato"]++;
    });
    return counts;
  }, [obras]);

  const entregasPorMes = useMemo(() => {
    const counts: Record<string, number> = {};
    obras.forEach((o) => {
      if (!o.fechaEntrega) return;
      const key = o.fechaEntrega.slice(0, 7);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts)
      .sort()
      .map((key) => {
        const [y, m] = key.split("-").map(Number);
        return { key, label: `${MONTH_ABBR_ES[m - 1]} ${y}`, count: counts[key] };
      });
  }, [obras]);

  const controlModelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    especificaciones.forEach((e) => {
      if (!e.control) return;
      e.control.split("-").map((s) => s.trim()).filter((s) => s && s !== "-").forEach((model) => {
        counts[model] = (counts[model] || 0) + 1;
      });
    });
    return Object.keys(counts)
      .map((model) => ({ model, count: counts[model] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [especificaciones]);

  if (error) {
    return (
      <div className="viz-root">
        <div className="wrap">
          <TopNav active="gestion" />
          <header className="page-head">
            <h1>Gestión de Refacciones — RCT</h1>
            <p className="sub">No se pudieron cargar los datos</p>
          </header>
          <div className="error-box" style={{ marginTop: 20 }}>
            <strong>Error:</strong> {error}
          </div>
        </div>
      </div>
    );
  }

  const obraFilter = obraSearch.trim().toLowerCase();
  const filteredObras = obraFilter
    ? obras.filter((o) => (o.obra + " " + (o.comunidad ?? "")).toLowerCase().includes(obraFilter))
    : obras;

  const specFilter = specSearch.trim().toLowerCase();
  const filteredSpecs = specFilter
    ? especificaciones.filter((e) => (e.obra + " " + (e.comunidad ?? "")).toLowerCase().includes(specFilter))
    : especificaciones;

  const maxMes = Math.max(...entregasPorMes.map((e) => e.count), 1);
  const maxModel = Math.max(...controlModelCounts.map((e) => e.count), 1);

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="gestion" />
        <header className="page-head">
          <h1>Gestión de Refacciones — RCT</h1>
          <p className="sub">Estado de entrega, garantías y especificaciones técnicas por obra</p>
          <div className="meta">
            <span>
              Fuente: <strong style={{ color: "var(--text-secondary)" }}>Base de datos - Información de Refacciones.xlsx</strong> (Google Drive)
            </span>
            <span className="dot" />
            <span>Actualizado en cada visita · última lectura {new Date(generatedAt).toLocaleString("es-CL")}</span>
          </div>
        </header>

        <div className="stats">
          <div className="stat-tile"><div className="v">{stats.total}</div><div className="l">Obras registradas</div></div>
          <div className="stat-tile"><div className="v">{stats.entregadas}</div><div className="l">Entregadas</div></div>
          <div className="stat-tile"><div className="v">{stats.pendientes}</div><div className="l">Pendientes de entrega</div></div>
          <div className="stat-tile"><div className="v">{stats.pct}%</div><div className="l">Avance de entrega</div></div>
        </div>

        <div className="two-col">
          <section className="summary">
            <h2>Estado SEREMI</h2>
            <p className="hint">Aprobación regulatoria por obra.</p>
            <div className="status-bar-list">
              {Object.entries(seremiCounts).map(([label, count]) => {
                const color =
                  label === "Aprobado" ? "var(--status-good)" :
                  label === "Pendiente" ? "var(--status-warning)" :
                  label === "Rechazado" ? "var(--status-critical)" : "var(--muted)";
                const max = Math.max(...Object.values(seremiCounts), 1);
                return (
                  <div className="bar-row" key={label}>
                    <div className="lbl"><span className="sw" style={{ background: color }} />{label}</div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / max) * 100}%`, background: color }} /></div>
                    <div className="n">{count}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="summary">
            <h2>Capacitaciones</h2>
            <p className="hint">Capacitación de administración entregada.</p>
            <div className="status-bar-list">
              {Object.entries(capacitacionCounts).map(([label, count]) => {
                const color =
                  label === "Sí" ? "var(--status-good)" :
                  label === "No" ? "var(--status-warning)" : "var(--muted)";
                const max = Math.max(...Object.values(capacitacionCounts), 1);
                return (
                  <div className="bar-row" key={label}>
                    <div className="lbl"><span className="sw" style={{ background: color }} />{label}</div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / max) * 100}%`, background: color }} /></div>
                    <div className="n">{count}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="summary">
          <h2>Entregas por mes</h2>
          <p className="hint">Cantidad de obras entregadas cada mes, todo el período registrado.</p>
          <div>
            {entregasPorMes.map((e) => (
              <div className="bar-row" key={e.key}>
                <div className="lbl">{e.label}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(e.count / maxMes) * 100}%`, background: "var(--accent)" }} /></div>
                <div className="n">{e.count}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="summary">
          <h2>Modelos de control más usados</h2>
          <p className="hint">Frecuencia de equipos de control instalados, útil para planificar repuestos.</p>
          <div>
            {controlModelCounts.map((e) => (
              <div className="bar-row" key={e.model}>
                <div className="lbl">{e.model}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(e.count / maxModel) * 100}%`, background: "var(--accent)" }} /></div>
                <div className="n">{e.count}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="summary">
          <h2>Detalle de obras</h2>
          <p className="hint">Estado de entrega, garantía y documentación por obra.</p>
          <input
            className="search-box"
            type="text"
            placeholder="Buscar obra o comunidad…"
            value={obraSearch}
            onChange={(e) => setObraSearch(e.target.value)}
          />
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Obra</th>
                  <th>Comunidad</th>
                  <th>Estado</th>
                  <th>Fecha entrega</th>
                  <th>Fecha garantía</th>
                  <th>Responsable</th>
                  <th>Capacitación</th>
                  <th>SEREMI</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {filteredObras.map((o, i) => (
                  <tr key={i}>
                    <td className="obra-col">{o.obra}</td>
                    <td>{o.comunidad ?? "—"}</td>
                    <td>{entregadoChip(o.entregado)}</td>
                    <td>{fmtDate(o.fechaEntrega)}</td>
                    <td>{fmtDate(o.fechaGarantia)}</td>
                    <td>{o.responsable ?? "—"}</td>
                    <td>{capacitacionChip(o.capacitacion)}</td>
                    <td>{seremiChip(o.seremi)}</td>
                    <td className="wrap-col">{o.observacion ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="summary">
          <h2>Especificaciones técnicas por edificio</h2>
          <p className="hint">Equipos instalados por edificio, según la hoja "Vista General REF".</p>
          <input
            className="search-box"
            type="text"
            placeholder="Buscar obra o edificio…"
            value={specSearch}
            onChange={(e) => setSpecSearch(e.target.value)}
          />
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Obra</th>
                  <th>Edificio</th>
                  <th>Centro de negocio</th>
                  <th>Potencia</th>
                  <th>Acumulación</th>
                  <th>Intercambio</th>
                  <th>Distribución (modelo)</th>
                  <th>Distribución (tag)</th>
                  <th>Eléctrico</th>
                  <th>Control</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpecs.map((e, i) => (
                  <tr key={i}>
                    <td className="obra-col">{e.obra}</td>
                    <td>{e.comunidad ?? "—"}</td>
                    <td>{e.centroNegocio ?? "—"}</td>
                    <td className="wrap-col">{e.potencia ?? "—"}</td>
                    <td className="wrap-col">{e.acumulacion ?? "—"}</td>
                    <td className="wrap-col">{e.intercambio ?? "—"}</td>
                    <td className="wrap-col">{e.distribucionModelo ?? "—"}</td>
                    <td className="wrap-col">{e.distribucionTag ?? "—"}</td>
                    <td className="wrap-col">{e.electrico ?? "—"}</td>
                    <td className="wrap-col">{e.control ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="note">
          <strong>Sobre esta página:</strong> los datos se leen directamente desde el archivo en Google Drive cada vez
          que alguien la visita. Si el archivo cambia de nombre o de carpeta, hay que actualizar el ID configurado en
          el proyecto.
        </footer>
      </div>
    </div>
  );
}
