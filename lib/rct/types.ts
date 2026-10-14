/** Línea contable de resultado (cuentas 3.x venta / 4.x gasto) de un centro de negocio RCT. */
export interface LineRow {
  d: string; // fecha "2026-05-13"
  cn: string; // CN AGRUPADO
  cd: string; // descripción del centro de negocio
  c1: string; // clasificador 1
  c2: string; // clasificador 2
  cm: string; // glosa
  al: string; // alias de la cuenta contable
  t: "G" | "V"; // G = gasto (cuentas 4), V = venta/ganancia (cuentas 3)
  m: number; // credit<>0 ? credit : -debit (gasto negativo, venta positiva)
  x?: 1; // cuenta 3110101002 (se omite en la vista "Económico")
}

/** Presupuesto (hoja de costo) agregado por obra y alias. */
export interface PptoRow {
  cn: string; // Nombre CN sin numeros (se cruza con CN AGRUPADO)
  alias: string;
  tipo: string; // CONTRATO | ADICIONAL
  importe: number; // venta positiva, gasto negativo
}

export interface RctData {
  generatedAt: string;
  ledgerRows: number;
  ledgerLastDate: string;
  lines: LineRow[];
  ppto: PptoRow[];
  /** [rut, nombre] del maestro de empleados. */
  empleados: [string, string][];
  /** CN AGRUPADO válidos del maestro de centros (los presupuestos solo se cruzan con estos). */
  cnList: string[];
}

/** Fila reducida de un sheet de movimientos. */
export type MovRow = {
  accountCode: unknown;
  debit: unknown;
  credit: unknown;
  comment: unknown;
  bc: unknown;
  c1: unknown;
  c2: unknown;
  date: unknown;
};

export interface BuildInputs {
  mov: MovRow[];
  planes: unknown[][]; // incluye cabecera
  idcn: unknown[][];
  pptos: unknown[][];
  empleados: unknown[][];
}
