/** Calculadora de presupuestos RCT: mismas fórmulas del Excel «Calculadora 2026 - RCT.xlsx». */

export interface CalcItem {
  id: string;
  descripcion: string;
  /** CLP por unidad. */
  unitario: number;
  /** Descuento en % (0 a 100). */
  dcto: number;
  cantidad: number;
  /** Solo para el PDF. */
  codigo: string;
  detalle: string;
}

export interface CalcTecnico {
  id: string;
  nombre: string;
  horas: number;
}

export interface CalcParams {
  /** Monto de insumos (CLP): se suma al costo de materiales antes de aplicar el margen. */
  insumos: number;
  /** Márgenes en % sobre la venta (0 a 99). */
  margenMateriales: number;
  margenManoObra: number;
  /** Costo de la hora-hombre del técnico (CLP). */
  costoHH: number;
  /** IVA en %. */
  iva: number;
}

export interface CalcSpec { id: string; label: string; value: string }
export interface CalcCuota { id: string; label: string; pct: number }

/** Datos que solo usa el PDF del presupuesto. */
export interface CalcDoc {
  codigo: string;
  /** "YYYY-MM-DD"; vacío = hoy. */
  fecha: string;
  cliente: string;
  observacion: string;
  detalleManoObra: string;
  incluyeManoObra: string;
  specsTitulo: string;
  specs: CalcSpec[];
  pagoCuotas: boolean;
  cuotas: CalcCuota[];
  pagoContado: boolean;
  /** Descuento por pago contado, en %. */
  dctoContado: number;
  transferencia: boolean;
  titular: string;
  rut: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  correoComprobante: string;
  /** Una condición por línea. */
  condiciones: string;
  firma: string;
}

export interface CalcState {
  items: CalcItem[];
  tecnicos: CalcTecnico[];
  params: CalcParams;
  doc: CalcDoc;
}

export const EMPRESA = { nombre: "New Energy Business SpA", marca: "NEB Chile", rut: "77.309.981-2", correo: "nicolas@nebchile.cl" };

export interface CalcResultado {
  costoMateriales: number;
  horasTotales: number;
  costoManoObra: number;
  costoTotal: number;
  ventaManoObra: number;
  ventaMateriales: number;
  ventaTotal: number;
  ventaConIva: number;
  utilidadManoObra: number;
  utilidadMateriales: number;
  utilidadTotal: number;
  /** Utilidad / venta total (0 a 1). */
  utilidadPct: number;
}

export const PARAMS_DEFECTO: CalcParams = { insumos: 0, margenMateriales: 25, margenManoObra: 30, costoHH: 10000, iva: 19 };

export const newId = () => Math.random().toString(36).slice(2, 10);

export const itemVacio = (): CalcItem => ({ id: newId(), descripcion: "", unitario: 0, dcto: 0, cantidad: 1, codigo: "", detalle: "" });

export const CONDICIONES_DEFECTO = [
  "Validez de la oferta: 15 días corridos desde la fecha de emisión.",
  "Precios expresados en pesos chilenos. Valores netos; el IVA se indica por separado.",
  "Plazo de ejecución: 10 días hábiles contados desde la aprobación del presupuesto, en fecha coordinada con la administración.",
  "No incluye obras civiles, modificaciones de sala de máquinas, refuerzos estructurales ni trabajos no descritos en el detalle de la oferta.",
  "Cualquier trabajo adicional no contemplado será presupuestado y aprobado previamente por escrito.",
].join("\n");

export const docDefecto = (): CalcDoc => ({
  codigo: "",
  fecha: "",
  cliente: "",
  observacion: "",
  detalleManoObra: "Instalación, conexión, puesta en marcha y seguimiento de funcionamiento",
  incluyeManoObra: "",
  specsTitulo: "Especificaciones técnicas",
  specs: [],
  pagoCuotas: true,
  cuotas: [
    { id: newId(), label: "Anticipo a la firma", pct: 50 },
    { id: newId(), label: "2ª cuota — a fin de mes", pct: 25 },
    { id: newId(), label: "3ª cuota — fin del mes siguiente", pct: 25 },
  ],
  pagoContado: true,
  dctoContado: 3,
  transferencia: true,
  titular: EMPRESA.nombre,
  rut: EMPRESA.rut,
  banco: "Banco de Chile",
  tipoCuenta: "Cuenta Corriente",
  numeroCuenta: "40786901",
  correoComprobante: EMPRESA.correo,
  condiciones: CONDICIONES_DEFECTO,
  firma: "Departamento de Servicio Técnico\nNEB Chile",
});

export function estadoInicial(): CalcState {
  return {
    items: [itemVacio()],
    tecnicos: [
      { id: newId(), nombre: "Técnico 1", horas: 0 },
      { id: newId(), nombre: "Técnico 2", horas: 0 },
    ],
    params: { ...PARAMS_DEFECTO },
    doc: docDefecto(),
  };
}

/** Completa con valores por defecto lo que falte en un estado guardado por una versión anterior. */
export function normalizarEstado(raw: Partial<CalcState>): CalcState {
  const base = estadoInicial();
  return {
    items: Array.isArray(raw.items) && raw.items.length ? raw.items.map((i) => ({ ...itemVacio(), ...i })) : base.items,
    tecnicos: Array.isArray(raw.tecnicos) ? raw.tecnicos : base.tecnicos,
    params: { ...PARAMS_DEFECTO, ...(raw.params ?? {}) },
    doc: { ...base.doc, ...(raw.doc ?? {}) },
  };
}

export const costoLinea = (i: CalcItem) => i.unitario * i.cantidad * (1 - i.dcto / 100);

/** Venta = costo / (1 − margen): el margen es sobre el precio de venta, no un recargo sobre el costo. */
const conMargen = (costo: number, margenPct: number) => costo / (1 - Math.min(Math.max(margenPct, 0), 99.9) / 100);

export function calcular(s: CalcState): CalcResultado {
  const { params: p } = s;
  const costoMateriales = s.items.reduce((t, i) => t + costoLinea(i), 0);
  const horasTotales = s.tecnicos.reduce((t, x) => t + x.horas, 0);
  const costoManoObra = horasTotales * p.costoHH;

  const ventaManoObra = conMargen(costoManoObra, p.margenManoObra);
  const ventaMateriales = conMargen(costoMateriales + p.insumos, p.margenMateriales);
  const ventaTotal = ventaManoObra + ventaMateriales;

  // Igual que el Excel, el costo de materiales de «Costos» no incluye los insumos: quedan dentro de la utilidad.
  const utilidadManoObra = ventaManoObra - costoManoObra;
  const utilidadMateriales = ventaMateriales - costoMateriales;
  const utilidadTotal = utilidadManoObra + utilidadMateriales;

  return {
    costoMateriales,
    horasTotales,
    costoManoObra,
    costoTotal: costoMateriales + costoManoObra,
    ventaManoObra,
    ventaMateriales,
    ventaTotal,
    ventaConIva: ventaTotal * (1 + p.iva / 100),
    utilidadManoObra,
    utilidadMateriales,
    utilidadTotal,
    utilidadPct: ventaTotal > 0 ? utilidadTotal / ventaTotal : 0,
  };
}

/* ───────────── Documento (PDF) ───────────── */

export interface LineaOferta {
  item: string;
  codigo: string;
  cantidad: number;
  detalle: string;
  unitario: number;
  total: number;
}

export interface Oferta {
  lineas: LineaOferta[];
  neto: number;
  iva: number;
  total: number;
  cuotas: { label: string; pct: number; monto: number }[];
  contado: { dctoPct: number; descuento: number; netoConDcto: number; iva: number; total: number; ahorro: number };
}

const r0 = (n: number) => Math.round(n);

/**
 * Líneas del PDF a precio de venta (neto). La venta de materiales se reparte entre los ítems según su peso en el costo
 * (el último absorbe el redondeo) y la mano de obra va en una línea aparte. Los totales salen de la suma de las líneas.
 */
export function armarOferta(s: CalcState): Oferta {
  const r = calcular(s);
  const lineas: LineaOferta[] = [];
  const conCosto = s.items.filter((i) => costoLinea(i) > 0);
  const ventaMat = r0(r.ventaMateriales);

  if (conCosto.length === 0) {
    if (ventaMat > 0) lineas.push({ item: "Materiales e insumos", codigo: "N/A", cantidad: 1, detalle: "", unitario: ventaMat, total: ventaMat });
  } else {
    let acumulado = 0;
    conCosto.forEach((i, idx) => {
      const total = idx === conCosto.length - 1 ? ventaMat - acumulado : r0((costoLinea(i) / r.costoMateriales) * r.ventaMateriales);
      acumulado += total;
      const cantidad = i.cantidad > 0 ? i.cantidad : 1;
      lineas.push({
        item: i.descripcion.trim() || "Ítem",
        codigo: i.codigo.trim() || "N/A",
        cantidad,
        detalle: i.detalle.trim(),
        unitario: r0(total / cantidad),
        total,
      });
    });
  }

  const ventaMO = r0(r.ventaManoObra);
  if (ventaMO > 0) {
    lineas.push({ item: "Mano de obra", codigo: "N/A", cantidad: 1, detalle: s.doc.detalleManoObra.trim(), unitario: ventaMO, total: ventaMO });
  }

  const ivaPct = s.params.iva / 100;
  const neto = lineas.reduce((t, l) => t + l.total, 0);
  const iva = r0(neto * ivaPct);
  const total = neto + iva;

  // Cuotas: cada una se trunca y la última lleva el resto, para que sumen exactamente el total.
  let asignado = 0;
  const cuotas = s.doc.cuotas.map((c, idx, arr) => {
    const monto = idx === arr.length - 1 ? total - asignado : Math.floor((total * c.pct) / 100);
    asignado += monto;
    return { label: c.label, pct: c.pct, monto };
  });

  const descuento = r0((neto * s.doc.dctoContado) / 100);
  const netoConDcto = neto - descuento;
  const ivaContado = r0(netoConDcto * ivaPct);
  const totalContado = netoConDcto + ivaContado;

  return {
    lineas,
    neto,
    iva,
    total,
    cuotas,
    contado: { dctoPct: s.doc.dctoContado, descuento, netoConDcto, iva: ivaContado, total: totalContado, ahorro: total - totalContado },
  };
}
