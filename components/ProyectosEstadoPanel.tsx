"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ETAPAS, etapaLabel, type EtapaKey, type ProyectoEstado } from "@/lib/proyectosEstadoTypes";

export type Paso = { num: number; title: string };
export type GuardarInput = { id?: string; nombre?: string; etapa: EtapaKey; paso: number | null };

type Props = {
  proyectos: ProyectoEstado[];
  sugerencias: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (input: GuardarInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  pasos: Partial<Record<EtapaKey, Paso[]>>;
  error: string | null;
};

const norm = (s: string) => s.trim().toLowerCase();

export default function ProyectosEstadoPanel({ proyectos, sugerencias, selectedId, onSelect, onSave, onDelete, pasos, error }: Props) {
  const listId = useId();
  const [nombre, setNombre] = useState("");
  const [etapa, setEtapa] = useState<EtapaKey>("venta");
  const [paso, setPaso] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = proyectos.find((p) => p.id === selectedId) ?? null;

  // El formulario sigue al proyecto seleccionado (también cuando se mueve haciendo click en un diagrama).
  useEffect(() => {
    if (!selected) return;
    setNombre(selected.nombre);
    setEtapa(selected.etapa);
    setPaso(selected.paso != null ? String(selected.paso) : "");
  }, [selected]);

  const opciones = useMemo(() => {
    const usados = new Set(proyectos.map((p) => norm(p.nombre)));
    return [...proyectos.map((p) => p.nombre), ...sugerencias.filter((s) => !usados.has(norm(s)))];
  }, [proyectos, sugerencias]);

  const pasosEtapa = pasos[etapa] ?? [];

  function cambiaNombre(v: string) {
    setNombre(v);
    const match = proyectos.find((p) => norm(p.nombre) === norm(v));
    onSelect(match ? match.id : null);
  }

  async function guardar() {
    if (!nombre.trim() || busy) return;
    setBusy(true);
    try {
      const n = paso ? Number(paso) : null;
      await onSave(selected ? { id: selected.id, etapa, paso: n } : { nombre: nombre.trim(), etapa, paso: n });
    } finally {
      setBusy(false);
    }
  }

  const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  const tituloPaso = (p: ProyectoEstado) => {
    if (p.paso == null) return null;
    const t = pasos[p.etapa]?.find((x) => x.num === p.paso)?.title;
    return t ? `${p.paso} · ${t}` : `Paso ${p.paso}`;
  };

  return (
    <section className="pe">
      <div className="pe-head">
        <h2>Estado de proyectos</h2>
        <p className="sub">
          Elige un proyecto (o escribe uno nuevo) e indica en qué etapa y paso está. También puedes dejar un proyecto seleccionado y hacer click en un paso numerado de Ingeniería u Operaciones para moverlo.
        </p>
      </div>

      <form className="pe-form" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
        <label className="pe-f grow">
          <span>Proyecto</span>
          <input list={listId} value={nombre} onChange={(e) => cambiaNombre(e.target.value)} placeholder="Escribe o elige un edificio…" maxLength={80} />
          <datalist id={listId}>{opciones.map((o) => <option key={o} value={o} />)}</datalist>
        </label>
        <label className="pe-f">
          <span>Etapa</span>
          <select value={etapa} onChange={(e) => { setEtapa(e.target.value as EtapaKey); setPaso(""); }}>
            {ETAPAS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
        </label>
        <label className="pe-f grow">
          <span>Paso</span>
          <select value={paso} onChange={(e) => setPaso(e.target.value)} disabled={pasosEtapa.length === 0}>
            <option value="">{pasosEtapa.length === 0 ? "Esta etapa no tiene pasos" : "Sin especificar"}</option>
            {pasosEtapa.map((p) => <option key={p.num} value={p.num}>{p.num} · {p.title}</option>)}
          </select>
        </label>
        <button type="submit" className="pe-save" disabled={!nombre.trim() || busy}>
          {busy ? "Guardando…" : selected ? "Guardar estado" : "Crear proyecto"}
        </button>
      </form>
      {nombre.trim() && !selected && <p className="pe-hint">«{nombre.trim()}» todavía no está registrado: se creará como proyecto nuevo.</p>}
      {error && <p className="pe-err" role="alert">{error}</p>}

      {proyectos.length > 0 && (
        <ul className="pe-list">
          {proyectos.map((p) => (
            <li key={p.id} className={p.id === selectedId ? "on" : undefined}>
              <button type="button" className="pe-row" onClick={() => onSelect(p.id === selectedId ? null : p.id)} aria-pressed={p.id === selectedId}>
                <b>{p.nombre}</b>
                <span className="pe-st">{etapaLabel(p.etapa)}</span>
                {tituloPaso(p) && <span className="pe-paso">{tituloPaso(p)}</span>}
                <span className="pe-date">{fecha(p.actualizado)}</span>
              </button>
              <button type="button" className="pe-del" aria-label={`Quitar ${p.nombre}`} onClick={() => { if (confirm(`¿Quitar «${p.nombre}» del seguimiento?`)) onDelete(p.id); }}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
