/** Línea contable de resultado (cuentas 3.x ganancia / 4.x gasto) de un centro de negocio RCT. */
export interface EerrLine {
  d: string; // fecha del voucher "2026-05-13"
  cn: string; // descripción del centro de negocio
  ac: string; // código de cuenta
  dp: string; // descripción de la cuenta
  al: string; // alias 2 de la cuenta
  cl: string; // clasificación del gasto (plan de cuentas), "" si no tiene
  tg: string; // Gasto Directo | Gasto Indirecto | Gasto Administrativo | "" (ventas)
  t: "G" | "V"; // G = gasto (cuentas 4), V = ganancia (cuentas 3)
  m: number; // Monto_EERR: credit<>0 ? credit : -debit (gasto negativo, venta positiva)
  ic: string; // InfoComprobante: tipo-número-glosa
}

export interface PptoVenta {
  d: string; // primer día del mes
  m: number; // MONTO CLP
}

export interface PptoGasto {
  d: string;
  tg: string; // Tipo_Gasto
  cl: string; // Clasificacion_gasto
  m: number; // Monto CLP (positivo)
}

export interface EerrData {
  generatedAt: string;
  ledgerRows: number;
  ledgerLastDate: string;
  /** Líneas de ledger de RCT sin fecha de voucher (no se pueden ubicar en el calendario). */
  sinFecha: number;
  lines: EerrLine[];
  pptoVenta: PptoVenta[];
  pptoGasto: PptoGasto[];
}

/** Fila reducida de un sheet de movimientos. */
export type MovRow = {
  accountCode: unknown;
  debit: unknown;
  credit: unknown;
  comment: unknown;
  bc: unknown;
  voucherNumber: unknown;
  voucherType: unknown;
  date: unknown;
};

export interface BuildInputs {
  mov: MovRow[];
  plan: unknown[][]; // ClasificaciónPlanCuentas, incluye cabecera
  centros: string[][]; // CSV de centros de negocio, incluye cabecera
  pptoGanancias: unknown[][];
  pptoGastos: unknown[][];
}
