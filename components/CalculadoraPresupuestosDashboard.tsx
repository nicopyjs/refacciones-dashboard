"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "./TopNav";
import {
  armarOferta,
  calcular,
  costoLinea,
  estadoInicial,
  itemVacio,
  newId,
  normalizarEstado,
  type CalcDoc,
  type CalcItem,
  type CalcParams,
  type CalcState,
} from "@/lib/calculadora";
import "../app/dashboard.css";
import "../app/rct/rct.css";
import "../app/calculadora-presupuestos/calculadora.css";

const STORAGE_KEY = "calculadora-presupuestos-v2";
const STORAGE_KEY_V1 = "calculadora-presupuestos-v1";

const TABS = [
  { id: "calculo", label: "Cálculo" },
  { id: "pdf", label: "Presupuesto PDF" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const nf = (n: number, dec = 0) => n.toLocaleString("es-CL", { maximumFractionDigits: dec });
const pct1 = (n: number) => `${(n * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nuevoEstado = (): CalcState => {
  const s = estadoInicial();
  return { ...s, doc: { ...s.doc, fecha: hoyISO() } };
};

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

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`calc-switch${on ? " on" : ""}`} onClick={() => onChange(!on)}>
      <i />
      <span>{label}</span>
    </button>
  );
}

function Card({ title, hint, right, children }: { title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="summary" style={{ marginTop: 0 }}>
      <div className="calc-head">
        <h2>{title}</h2>
        {right}
      </div>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

export default function CalculadoraPresupuestosDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("calculo");
  const [s, setS] = useState<CalcState>(estadoInicial);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  const cargado = useRef(false);

  // Se recuerda el último presupuesto en este navegador.
  useEffect(() => {
    let inicial = nuevoEstado();
    try {
      const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY_V1);
      if (saved) {
        const n = normalizarEstado(JSON.parse(saved) as Partial<CalcState>);
        inicial = { ...n, doc: { ...n.doc, fecha: n.doc.fecha || hoyISO() } };
      }
    } catch {
      /* sin almacenamiento: la calculadora funciona igual */
    }
    setS(inicial);
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
  const oferta = useMemo(() => armarOferta(s), [s]);
  const d = s.doc;

  const setParam = (k: keyof CalcParams, v: number) => setS((x) => ({ ...x, params: { ...x.params, [k]: v } }));
  const setDoc = (patch: Partial<CalcDoc>) => setS((x) => ({ ...x, doc: { ...x.doc, ...patch } }));
  const setItem = (id: string, patch: Partial<CalcItem>) => setS((x) => ({ ...x, items: x.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const setTec = (id: string, patch: Partial<CalcState["tecnicos"][number]>) =>
    setS((x) => ({ ...x, tecnicos: x.tecnicos.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const toggleDetalle = (id: string) =>
    setAbiertos((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  async function descargarPdf() {
    setErrorPdf(null);
    setGenerando(true);
    try {
      const { descargarPresupuestoPdf } = await import("@/lib/presupuestoPdf");
      await descargarPresupuestoPdf(s);
    } catch (e) {
      setErrorPdf(e instanceof Error ? e.message : "No se pudo generar el PDF.");
    } finally {
      setGenerando(false);
    }
  }

  async function copiar() {
    const lineas = [
      `PRESUPUESTO${d.codigo ? ` ${d.codigo}` : ""}${d.cliente ? ` - ${d.cliente}` : ""}`,
      ...oferta.lineas.map((l) => `- ${l.item}: ${nf(l.cantidad, 2)} x ${clp(l.unitario)} = ${clp(l.total)}`),
      "",
      `Subtotal neto: ${clp(oferta.neto)}`,
      `IVA (${nf(s.params.iva, 1)}%): ${clp(oferta.iva)}`,
      `Total: ${clp(oferta.total)}`,
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
  const sumaCuotas = d.cuotas.reduce((t, c) => t + c.pct, 0);
  const sinPrecio = oferta.lineas.length === 0;
  const faltan = [!d.cliente.trim() && "cliente", !d.codigo.trim() && "código"].filter(Boolean) as string[];

  /* ───────── Pestaña Cálculo ───────── */
  const tabCalculo = (
    <>
      <Card title="Parámetros" hint="Los márgenes son sobre el precio de venta: venta = costo ÷ (1 − margen).">
        <div className="calc-params five">
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
          <Campo label="Insumos">
            <div className="calc-unit pre">
              <span>$</span>
              <NumInput label="Insumos" value={s.params.insumos} onChange={(n) => setParam("insumos", n)} />
            </div>
          </Campo>
          <Campo label="IVA">
            <div className="calc-unit">
              <NumInput label="IVA" value={s.params.iva} decimals={1} max={100} onChange={(n) => setParam("iva", n)} />
              <span>%</span>
            </div>
          </Campo>
        </div>
      </Card>

      <Card
        title="Ítems a presupuestar"
        hint="Costo total = costo unitario × cantidad × (1 − descuento). Con «Detalle» agregas el código y la descripción que saldrán en el PDF."
        right={<button type="button" className="calc-btn primary" onClick={() => setS((x) => ({ ...x, items: [...x.items, itemVacio()] }))}>+ Agregar ítem</button>}
      >
        <div className="table-scroll">
          <table className="calc-table">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Descripción</th>
                <th style={{ width: 124 }}>Costo unitario</th>
                <th style={{ width: 88 }}>Dcto.</th>
                <th style={{ width: 82 }}>Cantidad</th>
                <th className="r" style={{ width: 112 }}>Costo total</th>
                <th style={{ width: 86 }} />
              </tr>
            </thead>
            <tbody>
              {s.items.map((i) => {
                const abierto = abiertos.has(i.id);
                const conDatos = !!(i.codigo.trim() || i.detalle.trim());
                return (
                  <Fragment key={i.id}>
                    <tr className={abierto ? "calc-open" : undefined}>
                      <td>
                        <input className="calc-input" aria-label="Descripción" placeholder="Ej: Bomba de impulsión F32/250B 15HP" value={i.descripcion} onChange={(e) => setItem(i.id, { descripcion: e.target.value })} />
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
                      <td className="calc-acts">
                        <button type="button" className={`calc-link${conDatos ? " has" : ""}`} aria-expanded={abierto} onClick={() => toggleDetalle(i.id)}>
                          Detalle {abierto ? "▴" : "▾"}
                        </button>
                        <button type="button" className="calc-del" aria-label="Quitar ítem" title="Quitar ítem" onClick={() => setS((x) => ({ ...x, items: x.items.length > 1 ? x.items.filter((y) => y.id !== i.id) : [itemVacio()] }))}>
                          ×
                        </button>
                      </td>
                    </tr>
                    {abierto && (
                      <tr className="calc-detail">
                        <td colSpan={6}>
                          <div className="calc-detail-grid">
                            <Campo label="Código (PDF)">
                              <input className="calc-input" placeholder="N/A" value={i.codigo} onChange={(e) => setItem(i.id, { codigo: e.target.value })} />
                            </Campo>
                            <Campo label="Detalle (PDF)">
                              <input className="calc-input" placeholder="Ej: Suministro bomba de impulsión F32/250B 15HP" value={i.detalle} onChange={(e) => setItem(i.id, { detalle: e.target.value })} />
                            </Campo>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
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
      </Card>

      <Card
        title="Mano de obra"
        hint="Horas por técnico × costo de la hora-hombre."
        right={<button type="button" className="calc-btn" onClick={() => setS((x) => ({ ...x, tecnicos: [...x.tecnicos, { id: newId(), nombre: `Técnico ${x.tecnicos.length + 1}`, horas: 0 }] }))}>+ Agregar técnico</button>}
      >
        <div className="table-scroll">
          <table className="calc-table">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Técnico</th>
                <th style={{ width: 124 }}>Horas</th>
                <th className="r" style={{ width: 112 }}>Costo</th>
                <th style={{ width: 86 }} />
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
                  <td className="calc-acts">
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
      </Card>
    </>
  );

  /* ───────── Pestaña Presupuesto PDF ───────── */
  const tabPdf = (
    <>
      <Card title="Datos del presupuesto" hint="Aparecen en el encabezado y en la ficha del cliente.">
        <div className="calc-form">
          <Campo label="Código del presupuesto">
            <input className="calc-input" placeholder="PST-0000-2026" value={d.codigo} onChange={(e) => setDoc({ codigo: e.target.value })} />
          </Campo>
          <Campo label="Fecha de emisión">
            <input className="calc-input" type="date" value={d.fecha} onChange={(e) => setDoc({ fecha: e.target.value })} />
          </Campo>
          <Campo label="Cliente" full>
            <input className="calc-input" placeholder="Ej: ESPACIO SAN MIGUEL" value={d.cliente} onChange={(e) => setDoc({ cliente: e.target.value })} />
          </Campo>
          <Campo label="Observación" full>
            <input className="calc-input" placeholder="Ej: Suministro e instalación bomba de impulsión F32/250B 15HP" value={d.observacion} onChange={(e) => setDoc({ observacion: e.target.value })} />
          </Campo>
        </div>
      </Card>

      <Card title="Detalle de la oferta" hint="Así sale en el PDF, a precio de venta neto. La venta de materiales se reparte entre los ítems según su costo; la mano de obra va en su propia línea.">
        {sinPrecio ? (
          <div className="calc-empty">Agrega ítems con costo o horas de mano de obra en la pestaña «Cálculo» para ver la oferta.</div>
        ) : (
          <div className="table-scroll">
            <table className="calc-table calc-preview">
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th className="r" style={{ width: 60 }}>Cant.</th>
                  <th className="r" style={{ width: 116 }}>Unitario neto</th>
                  <th className="r" style={{ width: 116 }}>Total neto</th>
                </tr>
              </thead>
              <tbody>
                {oferta.lineas.map((l, i) => (
                  <tr key={i}>
                    <td><b>{l.item}</b></td>
                    <td className="r">{nf(l.cantidad, 2)}</td>
                    <td className="r">{clp(l.unitario)}</td>
                    <td className="total">{clp(l.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3} className="r">Subtotal neto</td><td className="total">{clp(oferta.neto)}</td></tr>
                <tr><td colSpan={3} className="r">IVA ({nf(s.params.iva, 1)}%)</td><td className="total">{clp(oferta.iva)}</td></tr>
                <tr><td colSpan={3} className="r">Total bruto</td><td className="total">{clp(oferta.total)}</td></tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="calc-form" style={{ marginTop: 14 }}>
          <Campo label="Detalle de la línea de mano de obra" full>
            <input className="calc-input" value={d.detalleManoObra} onChange={(e) => setDoc({ detalleManoObra: e.target.value })} />
          </Campo>
          <Campo label="«La mano de obra incluye» (opcional)" full>
            <textarea className="calc-input" rows={3} placeholder="Ej: Retiro de equipo existente, montaje, conexiones hidráulicas, pruebas, puesta en marcha y asistencia de postventa." value={d.incluyeManoObra} onChange={(e) => setDoc({ incluyeManoObra: e.target.value })} />
          </Campo>
        </div>
      </Card>

      <Card
        title="Especificaciones técnicas"
        hint="Opcional. Una ficha de pares etiqueta / valor, por ejemplo Motor, Peso o Presión máxima."
        right={<button type="button" className="calc-btn" onClick={() => setDoc({ specs: [...d.specs, { id: newId(), label: "", value: "" }] })}>+ Agregar</button>}
      >
        <div className="calc-form" style={{ marginBottom: 10 }}>
          <Campo label="Título de la sección" full>
            <input className="calc-input" value={d.specsTitulo} onChange={(e) => setDoc({ specsTitulo: e.target.value })} />
          </Campo>
        </div>
        {d.specs.length === 0 ? (
          <div className="calc-empty">Sin especificaciones: esta sección no se incluye en el PDF.</div>
        ) : (
          <div className="calc-pairs">
            {d.specs.map((x) => (
              <div className="calc-pair" key={x.id}>
                <input className="calc-input" aria-label="Etiqueta" placeholder="Etiqueta" value={x.label} onChange={(e) => setDoc({ specs: d.specs.map((y) => (y.id === x.id ? { ...y, label: e.target.value } : y)) })} />
                <input className="calc-input" aria-label="Valor" placeholder="Valor" value={x.value} onChange={(e) => setDoc({ specs: d.specs.map((y) => (y.id === x.id ? { ...y, value: e.target.value } : y)) })} />
                <button type="button" className="calc-del" aria-label="Quitar" title="Quitar" onClick={() => setDoc({ specs: d.specs.filter((y) => y.id !== x.id) })}>×</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Condiciones de pago" hint="Elige qué opciones se ofrecen al cliente. Los montos se calculan sobre el total bruto.">
        <div className="calc-opts">
          <div className={`calc-opt${d.pagoCuotas ? " on" : ""}`}>
            <div className="calc-opt-head">
              <Switch on={d.pagoCuotas} onChange={(v) => setDoc({ pagoCuotas: v })} label="Opción A · Pago en cuotas" />
            </div>
            {d.pagoCuotas && (
              <>
                {d.cuotas.map((c, idx) => (
                  <div className="calc-cuota" key={c.id}>
                    <input className="calc-input" aria-label="Nombre de la cuota" value={c.label} onChange={(e) => setDoc({ cuotas: d.cuotas.map((y) => (y.id === c.id ? { ...y, label: e.target.value } : y)) })} />
                    <div className="calc-unit">
                      <NumInput label="Porcentaje de la cuota" value={c.pct} decimals={1} max={100} onChange={(n) => setDoc({ cuotas: d.cuotas.map((y) => (y.id === c.id ? { ...y, pct: n } : y)) })} />
                      <span>%</span>
                    </div>
                    <b className="calc-cuota-monto">{clp(oferta.cuotas[idx]?.monto ?? 0)}</b>
                    <button type="button" className="calc-del" aria-label="Quitar cuota" title="Quitar cuota" onClick={() => setDoc({ cuotas: d.cuotas.filter((y) => y.id !== c.id) })}>×</button>
                  </div>
                ))}
                <div className="calc-opt-foot">
                  <button type="button" className="calc-btn" onClick={() => setDoc({ cuotas: [...d.cuotas, { id: newId(), label: `${d.cuotas.length + 1}ª cuota`, pct: 0 }] })}>+ Agregar cuota</button>
                  <span className={`calc-sum${Math.abs(sumaCuotas - 100) > 0.05 ? " mal" : ""}`}>
                    {Math.abs(sumaCuotas - 100) > 0.05 ? `Suman ${nf(sumaCuotas, 1)}% (deberían sumar 100%)` : "Suman 100%"}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className={`calc-opt${d.pagoContado ? " on" : ""}`}>
            <div className="calc-opt-head">
              <Switch on={d.pagoContado} onChange={(v) => setDoc({ pagoContado: v })} label="Opción B · Pago contado con descuento" />
            </div>
            {d.pagoContado && (
              <>
                <div className="calc-cuota solo">
                  <span className="calc-lbl">Descuento sobre el neto</span>
                  <div className="calc-unit">
                    <NumInput label="Descuento por pago contado" value={d.dctoContado} decimals={1} max={100} onChange={(n) => setDoc({ dctoContado: n })} />
                    <span>%</span>
                  </div>
                </div>
                <div className="calc-rows" style={{ marginTop: 6 }}>
                  <Fila l="Total con descuento (neto)" v={clp(oferta.contado.netoConDcto)} />
                  <Fila l={`IVA (${nf(s.params.iva, 1)}%)`} v={clp(oferta.contado.iva)} />
                  <Fila l="Total bruto" v={clp(oferta.contado.total)} strong />
                  <Fila l="Ahorro frente a cuotas" v={clp(oferta.contado.ahorro)} />
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card title="Datos para transferencia" right={<Switch on={d.transferencia} onChange={(v) => setDoc({ transferencia: v })} label="Incluir en el PDF" />}>
        {d.transferencia ? (
          <div className="calc-form">
            <Campo label="Titular"><input className="calc-input" value={d.titular} onChange={(e) => setDoc({ titular: e.target.value })} /></Campo>
            <Campo label="RUT"><input className="calc-input" value={d.rut} onChange={(e) => setDoc({ rut: e.target.value })} /></Campo>
            <Campo label="Banco"><input className="calc-input" value={d.banco} onChange={(e) => setDoc({ banco: e.target.value })} /></Campo>
            <Campo label="Tipo de cuenta"><input className="calc-input" value={d.tipoCuenta} onChange={(e) => setDoc({ tipoCuenta: e.target.value })} /></Campo>
            <Campo label="N° de cuenta"><input className="calc-input" value={d.numeroCuenta} onChange={(e) => setDoc({ numeroCuenta: e.target.value })} /></Campo>
            <Campo label="Correo comprobante"><input className="calc-input" value={d.correoComprobante} onChange={(e) => setDoc({ correoComprobante: e.target.value })} /></Campo>
          </div>
        ) : (
          <div className="calc-empty">Esta sección no se incluye en el PDF.</div>
        )}
      </Card>

      <Card title="Condiciones generales y firma" hint="Una condición por línea; cada línea sale como un punto de la lista.">
        <div className="calc-form">
          <Campo label="Condiciones generales" full>
            <textarea className="calc-input" rows={7} value={d.condiciones} onChange={(e) => setDoc({ condiciones: e.target.value })} />
          </Campo>
          <Campo label="Firma (una línea por renglón; vacío = sin firma)" full>
            <textarea className="calc-input" rows={2} value={d.firma} onChange={(e) => setDoc({ firma: e.target.value })} />
          </Campo>
        </div>
      </Card>
    </>
  );

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="calculadora" />
        <header className="page-head">
          <h1>Calculadora de Presupuestos</h1>
          <p className="sub">Arma el presupuesto con materiales, horas de mano de obra, márgenes e IVA, revisa la utilidad y descarga la oferta en PDF</p>
          <div className="meta">
            <span>Réplica de «Calculadora 2026 - RCT»</span>
            <span className="dot" />
            <button type="button" onClick={logout} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0 }}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <div className="rct-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="calc-grid">
          <div className="calc-main">{tab === "calculo" ? tabCalculo : tabPdf}</div>

          <aside className="calc-side">
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
            </section>

            <section className="summary">
              <button type="button" className="calc-btn primary big" onClick={descargarPdf} disabled={generando || sinPrecio}>
                {generando ? "Generando PDF…" : "Descargar presupuesto en PDF"}
              </button>
              {sinPrecio ? (
                <p className="calc-note">Agrega al menos un ítem con costo para generar el PDF.</p>
              ) : faltan.length > 0 ? (
                <p className="calc-note">
                  Falta el {faltan.join(" y el ")} del presupuesto.{" "}
                  {tab !== "pdf" && <button type="button" className="calc-link has" onClick={() => setTab("pdf")}>Completar</button>}
                </p>
              ) : (
                <p className="calc-note ok">Listo para exportar: {d.codigo.trim()}</p>
              )}
              {errorPdf && <p className="calc-note err">{errorPdf}</p>}
              <div className="calc-actions">
                <button type="button" className="calc-btn" onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar resumen"}</button>
                <button
                  type="button"
                  className="calc-btn"
                  onClick={() => {
                    if (window.confirm("¿Limpiar el presupuesto y volver a los valores por defecto?")) {
                      setS(nuevoEstado());
                      setAbiertos(new Set());
                    }
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
