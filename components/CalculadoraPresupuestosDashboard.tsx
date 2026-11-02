"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "./TopNav";
import {
  PARAMS_DEFECTO,
  calcular,
  costoLinea,
  estadoInicial,
  itemVacio,
  newId,
  type CalcParams,
  type CalcState,
} from "@/lib/calculadora";
import "../app/dashboard.css";
import "../app/rct/rct.css";
import "../app/calculadora-presupuestos/calculadora.css";

const STORAGE_KEY = "calculadora-presupuestos-v1";

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const nf = (n: number, dec = 0) => n.toLocaleString("es-CL", { maximumFractionDigits: dec });
const pct1 = (n: number) => `${(n * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;

/** Número editable: se formatea con separador de miles al salir del campo y acepta coma o punto decimal. */
function NumInput({
  value,
  onChange,
  decimals = 0,
  max,
  placeholder = "0",
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  decimals?: number;
  max?: number;
  placeholder?: string;
  label: string;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  const shown = raw ?? (value ? nf(value, decimals) : "");

  function parse(s: string): number {
    const clean = decimals > 0 ? s.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "") : s.replace(/\D/g, "");
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : 0;
  }

  return (
    <input
      className="calc-input num"
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      aria-label={label}
      placeholder={placeholder}
      value={shown}
      onFocus={(e) => {
        setRaw(value ? String(value).replace(".", ",") : "");
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const s = e.target.value;
        setRaw(s);
        const n = parse(s);
        onChange(max != null ? Math.min(n, max) : n);
      }}
      onBlur={() => setRaw(null)}
    />
  );
}

function Campo({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`calc-field${full ? " full" : ""}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function Fila({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div className={`calc-row${strong ? " strong" : ""}`}>
      <span>{l}</span>
      <b>{v}</b>
    </div>
  );
}

export default function CalculadoraPresupuestosDashboard() {
  const router = useRouter();
  const [s, setS] = useState<CalcState>(estadoInicial);
  const [copiado, setCopiado] = useState(false);
  const cargado = useRef(false);

  // Se recuerda el último presupuesto en este navegador.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved) as CalcState;
        if (Array.isArray(p.items) && Array.isArray(p.tecnicos) && p.params) {
          setS({ ...p, params: { ...PARAMS_DEFECTO, ...p.params } });
        }
      }
    } catch {
      /* sin almacenamiento: la calculadora funciona igual */
    }
    cargado.current = true;
  }, []);

  useEffect(() => {
    if (!cargado.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* ignorar */
    }
  }, [s]);

  const r = useMemo(() => calcular(s), [s]);
  const setParam = (k: keyof CalcParams, v: number) => setS((x) => ({ ...x, params: { ...x.params, [k]: v } }));
  const setItem = (id: string, patch: Partial<CalcState["items"][number]>) =>
    setS((x) => ({ ...x, items: x.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const setTec = (id: string, patch: Partial<CalcState["tecnicos"][number]>) =>
    setS((x) => ({ ...x, tecnicos: x.tecnicos.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  async function copiar() {
    const lineas = [
      "PRESUPUESTO",
      ...s.items.filter((i) => i.descripcion || i.unitario).map((i) => `- ${i.descripcion || "(sin descripción)"}: ${nf(i.cantidad, 2)} x ${clp(i.unitario)}${i.dcto ? ` (-${nf(i.dcto, 1)}%)` : ""} = ${clp(costoLinea(i))}`),
      "",
      `Venta mano de obra: ${clp(r.ventaManoObra)}`,
      `Venta materiales: ${clp(r.ventaMateriales)}`,
      `Venta total: ${clp(r.ventaTotal)}`,
      `Venta + IVA (${nf(s.params.iva, 1)}%): ${clp(r.ventaConIva)}`,
    ];
    try {
      await navigator.clipboard.writeText(lineas.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* portapapeles no disponible */
    }
  }

  const utilClase = r.utilidadTotal < 0 ? "neg" : r.utilidadPct < 0.2 ? "bajo" : "";

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="calculadora" />
        <header className="page-head">
          <h1>Calculadora de Presupuestos</h1>
          <p className="sub">Arma un presupuesto con materiales, horas de mano de obra, márgenes e IVA, y revisa la venta y la utilidad al instante</p>
          <div className="meta">
            <span>Réplica de «Calculadora 2026 - RCT»</span>
            <span className="dot" />
            <button type="button" onClick={logout} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0 }}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <div className="calc-grid">
          {/* ───────── Entradas ───────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <section className="summary" style={{ marginTop: 0 }}>
              <div className="calc-head">
                <h2>Ítems a presupuestar</h2>
              </div>
              <p className="hint">Costo total = costo unitario × cantidad × (1 − descuento).</p>
              <div className="table-scroll">
                <table className="calc-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 200 }}>Descripción</th>
                      <th style={{ width: 120 }}>Costo unitario</th>
                      <th style={{ width: 86 }}>Dcto.</th>
                      <th style={{ width: 80 }}>Cantidad</th>
                      <th className="r" style={{ width: 110 }}>Costo total</th>
                      <th style={{ width: 34 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {s.items.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <input className="calc-input" aria-label="Descripción" placeholder="Ej: Empaquetadura acumulador" value={i.descripcion} onChange={(e) => setItem(i.id, { descripcion: e.target.value })} />
                        </td>
                        <td>
                          <div className="calc-unit pre">
                            <span>$</span>
                            <NumInput label="Costo unitario" value={i.unitario} onChange={(n) => setItem(i.id, { unitario: n })} />
                          </div>
                        </td>
                        <td>
                          <div className="calc-unit">
                            <NumInput label="Descuento" value={i.dcto} decimals={1} max={100} onChange={(n) => setItem(i.id, { dcto: n })} />
                            <span>%</span>
                          </div>
                        </td>
                        <td>
                          <NumInput label="Cantidad" value={i.cantidad} decimals={2} placeholder="1" onChange={(n) => setItem(i.id, { cantidad: n })} />
                        </td>
                        <td className="total">{clp(costoLinea(i))}</td>
                        <td>
                          <button type="button" className="calc-del" aria-label="Quitar ítem" title="Quitar ítem" onClick={() => setS((x) => ({ ...x, items: x.items.length > 1 ? x.items.filter((y) => y.id !== i.id) : [itemVacio()] }))}>
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="r">Costo materiales</td>
                      <td className="total">{clp(r.costoMateriales)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="calc-actions">
                <button type="button" className="calc-btn primary" onClick={() => setS((x) => ({ ...x, items: [...x.items, itemVacio()] }))}>+ Agregar ítem</button>
              </div>
            </section>

            <section className="summary" style={{ marginTop: 0 }}>
              <div className="calc-head">
                <h2>Mano de obra</h2>
              </div>
              <p className="hint">Horas por técnico × costo de la hora-hombre.</p>
              <div className="table-scroll">
                <table className="calc-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 200 }}>Técnico</th>
                      <th style={{ width: 120 }}>Horas</th>
                      <th className="r" style={{ width: 110 }}>Costo</th>
                      <th style={{ width: 34 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {s.tecnicos.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <input className="calc-input" aria-label="Nombre del técnico" value={t.nombre} onChange={(e) => setTec(t.id, { nombre: e.target.value })} />
                        </td>
                        <td>
                          <NumInput label={`Horas de ${t.nombre}`} value={t.horas} decimals={1} onChange={(n) => setTec(t.id, { horas: n })} />
                        </td>
                        <td className="total">{clp(t.horas * s.params.costoHH)}</td>
                        <td>
                          <button type="button" className="calc-del" aria-label="Quitar técnico" title="Quitar técnico" onClick={() => setS((x) => ({ ...x, tecnicos: x.tecnicos.filter((y) => y.id !== t.id) }))}>
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="r">{nf(r.horasTotales, 1)} horas en total</td>
                      <td />
                      <td className="total">{clp(r.costoManoObra)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="calc-actions">
                <button type="button" className="calc-btn" onClick={() => setS((x) => ({ ...x, tecnicos: [...x.tecnicos, { id: newId(), nombre: `Técnico ${x.tecnicos.length + 1}`, horas: 0 }] }))}>+ Agregar técnico</button>
              </div>
            </section>
          </div>

          {/* ───────── Parámetros y resultados ───────── */}
          <aside className="calc-side">
            <section className="summary">
              <h2>Parámetros</h2>
              <div className="calc-params" style={{ marginTop: 10 }}>
                <Campo label="Margen materiales">
                  <div className="calc-unit">
                    <NumInput label="Margen materiales" value={s.params.margenMateriales} decimals={1} max={99} onChange={(n) => setParam("margenMateriales", n)} />
                    <span>%</span>
                  </div>
                </Campo>
                <Campo label="Margen mano de obra">
                  <div className="calc-unit">
                    <NumInput label="Margen mano de obra" value={s.params.margenManoObra} decimals={1} max={99} onChange={(n) => setParam("margenManoObra", n)} />
                    <span>%</span>
                  </div>
                </Campo>
                <Campo label="Costo HH técnico">
                  <div className="calc-unit pre">
                    <span>$</span>
                    <NumInput label="Costo hora-hombre" value={s.params.costoHH} onChange={(n) => setParam("costoHH", n)} />
                  </div>
                </Campo>
                <Campo label="IVA">
                  <div className="calc-unit">
                    <NumInput label="IVA" value={s.params.iva} decimals={1} max={100} onChange={(n) => setParam("iva", n)} />
                    <span>%</span>
                  </div>
                </Campo>
                <Campo label="Insumos (se suman a la venta de materiales)" full>
                  <div className="calc-unit pre">
                    <span>$</span>
                    <NumInput label="Insumos" value={s.params.insumos} onChange={(n) => setParam("insumos", n)} />
                  </div>
                </Campo>
              </div>
            </section>

            <section className="summary">
              <h2>Venta</h2>
              <div className="calc-hero" style={{ marginTop: 10 }}>
                <div className="l">Venta + IVA ({nf(s.params.iva, 1)}%)</div>
                <div className="v">{clp(r.ventaConIva)}</div>
                <div className="s">Neto {clp(r.ventaTotal)}</div>
              </div>
              <div className="calc-rows">
                <Fila l="Venta mano de obra" v={clp(r.ventaManoObra)} />
                <Fila l="Venta materiales" v={clp(r.ventaMateriales)} />
                <Fila l="Venta total (neto)" v={clp(r.ventaTotal)} strong />
              </div>
            </section>

            <section className="summary">
              <h2>Costos y utilidad</h2>
              <div className="calc-rows" style={{ marginTop: 6 }}>
                <Fila l="Costo materiales" v={clp(r.costoMateriales)} />
                <Fila l="Costo mano de obra" v={clp(r.costoManoObra)} />
                <Fila l="Costo total" v={clp(r.costoTotal)} strong />
                <Fila l="Utilidad mano de obra" v={clp(r.utilidadManoObra)} />
                <Fila l="Utilidad materiales" v={clp(r.utilidadMateriales)} />
                <div className="calc-row strong">
                  <span>Utilidad total</span>
                  <b>
                    {clp(r.utilidadTotal)} <span className={`calc-util-pct ${utilClase}`}>{pct1(r.utilidadPct)}</span>
                  </b>
                </div>
              </div>
              <div className="calc-actions">
                <button type="button" className="calc-btn primary" onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar resumen"}</button>
                <button
                  type="button"
                  className="calc-btn"
                  onClick={() => {
                    if (window.confirm("¿Limpiar el presupuesto y volver a los valores por defecto?")) setS(estadoInicial());
                  }}
                >
                  Limpiar
                </button>
              </div>
            </section>
          </aside>
        </div>

        <footer className="note">
          <strong>Cómo se calcula:</strong> venta = costo ÷ (1 − margen), es decir, el margen es sobre el precio de venta. La venta de materiales incluye los insumos; el costo de materiales
          mostrado no, así que los insumos quedan dentro de la utilidad de materiales (igual que en el Excel). Tu presupuesto se guarda solo en este navegador.
        </footer>
      </div>
    </div>
  );
}
