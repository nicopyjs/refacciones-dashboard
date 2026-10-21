"use client";

import { useEffect, useRef, useState } from "react";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Selector de varios meses (vacío = todos). Valores "01".."12". */
export default function MonthPicker({ value, onChange }: { value: string[]; onChange: (m: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const toggle = (m: string) => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m].sort());
  const label = value.length === 0 ? "Todos" : value.length <= 2 ? value.map((m) => MESES[Number(m) - 1]).join(", ") : `${value.length} meses`;
  return (
    <div className="eerr-multi" ref={ref}>
      <span>Mes</span>
      <button type="button" className="eerr-multi-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label} <i aria-hidden>▾</i>
      </button>
      {open && (
        <div className="eerr-multi-pop" role="listbox" aria-multiselectable="true">
          <label className="all">
            <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} /> Todos
          </label>
          {MESES.map((m, i) => {
            const k = String(i + 1).padStart(2, "0");
            return (
              <label key={k}>
                <input type="checkbox" checked={value.includes(k)} onChange={() => toggle(k)} /> {m}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
