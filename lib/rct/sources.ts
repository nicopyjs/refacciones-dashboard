import ExcelJS from "exceljs";
import { getGoogleToken } from "../googleAuth";
import type { MovRow } from "./types";

// Fuentes (Google Drive / Sheets compartidos con la cuenta de servicio).
export const FUENTES = {
  movHistorico: "15xMsuXMCpybua22fZhunG2vL2Nbtlr-8-8rGobI-mhc", // 2021-2025
  mov2026: "1IGN_SaV7zKqwMRGc21N_avA-pyWtI4sY6IxnADbU9oU",
  planes: "1H6a16Mj3VShFgXXf6nnLZ08udW7xT0X6m4NPsL_BXxU",
  idcn: "1XCeMZRw6bU--3SeOFRI08J5eFxaFbvVflPWWaczufQc",
  pptos: "1y70sUTgoubVQTLKKWUINrz5YsoTYSfs8", // xlsx en Drive
  empleados: "19Z21VDaqtKOC9IolM6KPTQ6h4GY4SVR4C893tAIrank",
} as const;

const MOV_TAB = "Hoja 1";
const MOV_HEADERS: Record<string, string> = {
  B: "accountCode",
  C: "debit",
  D: "credit",
  H: "comment",
  O: "bussinessCenterId",
  P: "classifier1Id",
  Q: "classifier2Id",
  Y: "date",
};

async function authFetch(url: string): Promise<Response> {
  const token = await getGoogleToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Google API ${res.status} en ${url.split("?")[0]}: ${body}`);
  }
  return res;
}

const q = (s: string) => encodeURIComponent(s);

export async function sheetValues(id: string, tab: string): Promise<unknown[][]> {
  const res = await authFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${q(tab)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`
  );
  const j = (await res.json()) as { values?: unknown[][] };
  return j.values ?? [];
}

async function batchGet(id: string, ranges: string[]): Promise<unknown[][][]> {
  const params = ranges.map((r) => `ranges=${q(r)}`).join("&");
  const res = await authFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchGet?${params}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`
  );
  const j = (await res.json()) as { valueRanges?: { values?: unknown[][] }[] };
  return (j.valueRanges ?? []).map((v) => v.values ?? []);
}

export async function driveXlsxRows(id: string, sheetName: string): Promise<unknown[][]> {
  const res = await authFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await res.arrayBuffer()) as unknown as ArrayBuffer);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error(`El archivo ${id} no tiene la hoja "${sheetName}".`);
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const a: unknown[] = [];
    for (let c = 1; c <= row.cellCount; c++) {
      let v = row.getCell(c).value as unknown;
      if (v && typeof v === "object" && !(v instanceof Date)) {
        const o = v as Record<string, unknown>;
        if ("result" in o) v = o.result;
        else if ("richText" in o) v = (o.richText as { text: string }[]).map((t) => t.text).join("");
        else if ("text" in o) v = o.text;
      }
      a[c - 1] = v ?? null;
    }
    rows.push(a);
  });
  return rows;
}

async function movimientos(id: string): Promise<MovRow[]> {
  const [header] = await batchGet(id, [`'${MOV_TAB}'!A1:Z1`]);
  const h = (header[0] ?? []) as string[];
  const colIndex = (letter: string) => letter.charCodeAt(0) - 65;
  for (const [letter, name] of Object.entries(MOV_HEADERS)) {
    if (h[colIndex(letter)] !== name) {
      throw new Error(`El sheet de movimientos ${id} cambió de formato: la columna ${letter} debería ser "${name}" y es "${h[colIndex(letter)]}".`);
    }
  }
  const [bcd, comment, oq, date] = await batchGet(id, [
    `'${MOV_TAB}'!B2:D`,
    `'${MOV_TAB}'!H2:H`,
    `'${MOV_TAB}'!O2:Q`,
    `'${MOV_TAB}'!Y2:Y`,
  ]);
  const out: MovRow[] = new Array(bcd.length);
  for (let i = 0; i < bcd.length; i++) {
    const a = bcd[i] ?? [];
    const o = oq[i] ?? [];
    out[i] = {
      accountCode: a[0],
      debit: a[1],
      credit: a[2],
      comment: comment[i]?.[0],
      bc: o[0],
      c1: o[1],
      c2: o[2],
      date: date[i]?.[0],
    };
  }
  return out;
}

export async function loadAllInputs() {
  const [movA, movB, planes, idcn, pptos, empleados] = await Promise.all([
    movimientos(FUENTES.movHistorico),
    movimientos(FUENTES.mov2026),
    sheetValues(FUENTES.planes, "PlanesCuenta"),
    sheetValues(FUENTES.idcn, "centros_negocio"),
    driveXlsxRows(FUENTES.pptos, "PPTOS"),
    sheetValues(FUENTES.empleados, "Maestro Empleados"),
  ]);
  return { mov: movA.concat(movB), planes, idcn, pptos, empleados };
}
