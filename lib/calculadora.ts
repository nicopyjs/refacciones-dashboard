/** Calculadora de presupuestos RCT: mismas fórmulas del Excel «Calculadora 2026 - RCT.xlsx». */

export interface CalcItem {
  id: string;
  descripcion: string;
  /** CLP por unidad. */
  unitario: number;
  /** Descuento en % (0 a 100). */
  dcto: number;
  cantidad: number;
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

export interface CalcState {
  items: CalcItem[];
  tecnicos: CalcTecnico[];
  params: CalcParams;
}

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

export const itemVacio = (): CalcItem => ({ id: newId(), descripcion: "", unitario: 0, dcto: 0, cantidad: 1 });

export function estadoInicial(): CalcState {
  return {
    items: [itemVacio()],
    tecnicos: [
      { id: newId(), nombre: "Técnico 1", horas: 0 },
      { id: newId(), nombre: "Técnico 2", horas: 0 },
    ],
    params: { ...PARAMS_DEFECTO },
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
