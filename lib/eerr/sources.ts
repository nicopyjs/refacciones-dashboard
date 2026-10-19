import { FUENTES, authFetch, batchGet, driveXlsxRows, sheetValues } from "../rct/sources";
import type { MovRow } from "./types";

// Centros de negocio (CSV en Drive) y presupuestos (xlsx en Drive) propios de este reporte.
const CENTROS_CSV = "1R4hS-U3eXxTsRFda0ewk9JmF-_r6YwkJ";
const PPTO_XLSX = "1H-vXLc8HwauSscBSQ3QxiKjBM-MCM1sU";

const MOV_TAB = "Hoja 1";
const MOV_HEADERS: Record<string, string> = {
  B: "accountCode",
  C: "debit",
  D: "credit",
  H: "comment",
  O: "bussinessCenterId",
  U: "voucherNumber",
  V: "voucherType",
  Y: "date",
};

async function movimientos(id: string): Promise<MovRow[]> {
  const [header] = await batchGet(id, [`'${MOV_TAB}'!A1:Z1`]);
  const h = (header[0] ?? []) as string[];
  const colIndex = (letter: string) => letter.charCodeAt(0) - 65;
  for (const [letter, name] of Object.entries(MOV_HEADERS)) {
    if (h[colIndex(letter)] !== name) {
      throw new Error(`El sheet de movimientos ${id} cambió de formato: la columna ${letter} debería ser "${name}" y es "${h[colIndex(letter)]}".`);
    }
  }
  const [bcd, comment, bc, uv, date] = await batchGet(id, [
    `'${MOV_TAB}'!B2:D`,
    `'${MOV_TAB}'!H2:H`,
    `'${MOV_TAB}'!O2:O`,
    `'${MOV_TAB}'!U2:V`,
    `'${MOV_TAB}'!Y2:Y`,
  ]);
  const out: MovRow[] = new Array(bcd.length);
  for (let i = 0; i < bcd.length; i++) {
    const a = bcd[i] ?? [];
    const u = uv[i] ?? [];
    out[i] = {
      accountCode: a[0],
      debit: a[1],
      credit: a[2],
      comment: comment[i]?.[0],
      bc: bc[i]?.[0],
      voucherNumber: u[0],
      voucherType: u[1],
      date: date[i]?.[0],
    };
  }
  return out;
}

/** CSV simple con comillas dobles (RFC 4180). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

async function centrosCsv(): Promise<string[][]> {
  const res = await authFetch(`https://www.googleapis.com/drive/v3/files/${CENTROS_CSV}?alt=media`);
  return parseCsv((await res.text()).replace(/^﻿/, ""));
}

export async function loadEerrInputs() {
  const [movA, movB, plan, centros, pptoGanancias, pptoGastos] = await Promise.all([
    movimientos(FUENTES.movHistorico),
    movimientos(FUENTES.mov2026),
    sheetValues(FUENTES.planes, "ClasificaciónPlanCuentas"),
    centrosCsv(),
    driveXlsxRows(PPTO_XLSX, "Ganancias"),
    driveXlsxRows(PPTO_XLSX, "AnexoPsto"),
  ]);
  return { mov: movA.concat(movB), plan, centros, pptoGanancias, pptoGastos };
}
