/** Todos los arreglos mensuales van alineados con `months` ("YYYY-MM"). Montos en CLP. */
export interface FlujoProyecto {
  nombre: string;
  /** Mes del primer pago (Metrogas + comunidad). */
  primerPago: string;
  /** Primer y último mes del modelo de caja (14 meses). */
  mes1: string;
  ultimo: string;
  flujoNeto: number;
  resultado: number;
  margen: number;
  /** Flujo neto mensual (c/IVA). */
  flujo: number[];
  /** Resultado mensual (sin IVA, devengado). */
  rent: number[];
}

export interface FlujoFacturaFila {
  proyecto: string;
  concepto: string;
  /** Cuotas "con provisionamiento": solo entran al flujo cuando el filtro lo pide. */
  provision: boolean;
  total: number;
  /** Neto facturado por mes (sin IVA). */
  meses: number[];
}

export interface FlujoData {
  generatedAt: string;
  archivo: string;
  months: string[];
  iva: number;
  desfaseCobro: number;
  costoIndirectoMensual: number;
  cobros: {
    metrogas: number[];
    comunidad: number[];
    entregados: number[];
    /** Cobro (c/IVA) de las cuotas con provisionamiento; el filtro decide si se suma. */
    provision: number[];
  };
  pagos: { materiales: number[]; manoObra: number[] };
  indirecto: number[];
  proyectosEnCurso: number[];
  rent: {
    venta: number[];
    entregados: number[];
    /** Ingreso (sin IVA) de las cuotas con provisionamiento. */
    provision: number[];
    manoObra: number[];
    materiales: number[];
    certificacion: number[];
    indirecto: number[];
  };
  proyectos: FlujoProyecto[];
  facturacion: FlujoFacturaFila[];
  notas: string[];
}
