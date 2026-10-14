export type AreaRct = "RCT" | "INTA";
export type TipoCuenta = "Gasto" | "Ganancia";

/** Movimiento contable agregado por mes, centro de negocio agrupado y alias de cuenta. */
export interface GlRow {
  ym: string; // "2026-05"
  area: AreaRct;
  cn: string; // CN AGRUPADO
  alias: string; // alias de la cuenta contable (PlanesCuenta)
  tipo: TipoCuenta;
  monto: number; // credit<>0 ? credit : -debit (gasto negativo, ganancia positiva)
}

/** Línea contable de gasto para la tabla "Detalles facturación DF". */
export interface DetalleRow {
  date: string; // "2026-05-13"
  c1: string;
  c2: string;
  comment: string;
  alias: string;
  cnDesc: string;
  cn: string;
  monto: number;
}

/** Presupuesto (hoja de costo) agregado por obra y alias. */
export interface PptoRow {
  cn: string; // Nombre CN sin numeros (se cruza con CN AGRUPADO)
  alias: string;
  tipo: string; // CONTRATO | ADICIONAL
  importe: number;
}

export interface PptoGastoRow {
  ym: string;
  area: string;
  monto: number;
}

export interface AdicionalRow {
  obra: string;
  tipo: string;
  codigo: string;
  asunto: string;
  valorUf: number;
  estado: string;
  fechaApr: string | null;
  fac: string;
  fechaFac: string | null;
  montoClp: number;
}

export interface ObraSupervisorRow {
  obra: string;
  supervisor: string;
}

export interface RctData {
  generatedAt: string;
  ledgerRows: number;
  ledgerLastDate: string;
  gl: GlRow[];
  detalleIndirectos: DetalleRow[];
  ppto: PptoRow[];
  pptoGastos: PptoGastoRow[];
  adicionales: AdicionalRow[];
  obraSupervisor: ObraSupervisorRow[];
  /** CN AGRUPADO válidos del maestro de centros (los presupuestos solo se cruzan con estos). */
  cnList: string[];
}

/** Cabeceras de los sheets de movimientos que usamos (se validan al leer). */
export const MOV_COLUMNS = {
  accountCode: "B",
  debit: "C",
  credit: "D",
  comment: "H",
  bussinessCenterId: "O",
  classifier1Id: "P",
  classifier2Id: "Q",
  date: "Y",
} as const;

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
  pptoGastos: unknown[][];
  adicionales: unknown[][];
  obraSupervisor: unknown[][];
}
