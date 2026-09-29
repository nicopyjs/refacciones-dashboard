import type ExcelJS from "exceljs";
import { cellFillHex, cellValue, loadWorkbook } from "./driveFile";

export type FacturacionStatus = "fact" | "esp" | "proy";

export interface FacturacionItem {
  month: string;
  concept: string;
  amount: number;
  status: FacturacionStatus;
  cell: string;
}

export interface FacturacionProject {
  row: number;
  code: string;
  name: string;
  full: string;
  items: FacturacionItem[];
  header: Record<string, number>;
}

export interface FacturacionMonthControl {
  real?: number;
  total?: number;
  proy?: number;
  missing: { code: string; name: string; amount: number }[];
  realFormulaRow?: number;
  crossRefs?: string[];
  breakdown: {
    row: number;
    label: string;
    faltan: { code: string; name: string; cell: string; amount: number }[];
    sobran: { code: string; name: string; cell: string }[];
  }[];
}

export interface FacturacionData {
  sheet: string;
  months: string[];
  projects: FacturacionProject[];
  excel: Record<string, FacturacionMonthControl>;
  rows: { real: number | null; total: number | null; proy: number | null };
}

const FACTURACION_FILE_ID = process.env.FACTURACION_FILE_ID || "1WBZvbNFgGG_GKONd5p-XCT2oGgBuR7Sy";

const GREEN = ["00B050", "92D050"];
const YELLOW = ["FFFF00"];
const CELESTE = "00B0F0";

// Only solid fills count as a status color (same rule as the original tablero).
const solidFill = (c: ExcelJS.Cell) => {
  const f = c.fill;
  return f && f.type === "pattern" && f.pattern === "solid" ? cellFillHex(c) : null;
};

const status = (f: string | null): FacturacionStatus =>
  f && GREEN.includes(f) ? "fact" : f && YELLOW.includes(f) ? "esp" : "proy";

function conceptOf(s: string): string | null {
  const t = s.toLowerCase();
  if (t.startsWith("anticipo")) return "Anticipo";
  if (t.startsWith("acta")) return "Acta de entrega";
  if (t.startsWith("certific")) return "Certificación";
  if (t.startsWith("cuota") || t.startsWith("couta")) return "Cuotas";
  return null;
}

// 0-based column index -> letters (0 = A)
function colLetter(c: number): string {
  let s = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export function parseFacturacionSheet(wb: ExcelJS.Workbook): FacturacionData {
  const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === "facturacion real");
  if (!ws) throw new Error('No se encontró la pestaña "Facturacion Real"');

  const lastRow = ws.rowCount;
  const lastCol = ws.columnCount - 1; // 0-based
  // r, c are 0-based like the original SheetJS parser
  const cell = (r: number, c: number) => ws.getRow(r + 1).getCell(c + 1);
  const val = (r: number, c: number) => cellValue(cell(r, c));
  const num = (r: number, c: number) => {
    const v = val(r, c);
    return typeof v === "number" && isFinite(v) ? v : 0;
  };
  const txt = (r: number, c: number) => {
    const v = val(r, c);
    return v != null ? String(v).trim() : "";
  };
  const formula = (r: number, c: number): string => {
    try {
      return cell(r, c).formula || "";
    } catch {
      return "";
    }
  };

  // Meses (fila 1)
  const months: { col: number; key: string; letter: string }[] = [];
  for (let c = 1; c <= lastCol; c++) {
    const h = val(0, c);
    let y: number, m: number;
    if (h instanceof Date) {
      y = h.getUTCFullYear();
      m = h.getUTCMonth() + 1;
    } else continue;
    months.push({ col: c, key: `${y}-${String(m).padStart(2, "0")}`, letter: colLetter(c) });
  }

  const projects: FacturacionProject[] = [];
  const labels: Record<string, number> = {};
  let cur: FacturacionProject | null = null;
  let inTotals = false;
  for (let r = 1; r < lastRow; r++) {
    const label = txt(r, 0);
    const up = label.toUpperCase();
    if (up === "REAL" && !inTotals) inTotals = true;
    if (inTotals) {
      if (up && labels[up] == null) labels[up] = r;
      continue;
    }
    if (label && solidFill(cell(r, 0)) === CELESTE) {
      const m = label.match(/^(RCTA\s?\S+?)\s*-\s*(.+)$/i);
      cur = {
        row: r + 1,
        code: m ? m[1].replace(/\s/g, "") : "",
        name: m ? m[2].trim() : label.replace(/^RCTA/i, "").trim(),
        full: label,
        items: [],
        header: {},
      };
      for (const mo of months) cur.header[mo.key] = num(r, mo.col);
      projects.push(cur);
      continue;
    }
    if (!cur) continue;
    const concept = conceptOf(label);
    if (!concept) continue;
    for (const mo of months) {
      const v = num(r, mo.col);
      if (!v) continue;
      cur.items.push({
        month: mo.key,
        concept,
        amount: Math.round(v),
        status: status(solidFill(cell(r, mo.col))),
        cell: mo.letter + (r + 1),
      });
    }
  }

  const pick = (lab: string) => (labels[lab] != null ? labels[lab] : null);
  const rowReal = pick("REAL"), rowTotal = pick("TOTAL"), rowProy = pick("PROYECTADO");
  const refsIn = (f: string, letter: string) =>
    new Set((f.match(new RegExp(`\\b${letter}(\\d+)\\b`, "g")) || []).map((s) => parseInt(s.slice(letter.length), 10)));

  const excel: Record<string, FacturacionMonthControl> = {};
  for (const mo of months) {
    const e: FacturacionMonthControl = { missing: [], breakdown: [] };
    if (rowReal != null) e.real = Math.round(num(rowReal, mo.col));
    if (rowTotal != null) e.total = Math.round(num(rowTotal, mo.col));
    if (rowProy != null) e.proy = Math.round(num(rowProy, mo.col));
    if (rowReal != null) {
      const f = formula(rowReal, mo.col);
      const refs = refsIn(f, mo.letter);
      for (const p of projects) {
        const amt = p.items.filter((i) => i.month === mo.key).reduce((s, i) => s + i.amount, 0);
        if (amt && !refs.has(p.row)) e.missing.push({ code: p.code, name: p.name, amount: amt });
      }
      e.realFormulaRow = rowReal + 1;
      e.crossRefs = (f.match(/\b[A-Z]{1,2}\d+\b/g) || []).filter((ref) => ref.replace(/\d+/, "") !== mo.letter);
    }
    const brk: [string, string, number][] = [
      ["ANTICIPO", "Anticipo", 1],
      ["ACTA ENTREGA", "Acta de entrega", 2],
      ["CERTIFICACION", "Certificación", 3],
      ["CUOTAS", "Cuotas", 4],
    ];
    for (const [lab, concept, off] of brk) {
      const r0 = pick(lab);
      if (r0 == null) continue;
      const refs = refsIn(formula(r0, mo.col), mo.letter);
      const faltan: FacturacionMonthControl["breakdown"][number]["faltan"] = [];
      const sobran: FacturacionMonthControl["breakdown"][number]["sobran"] = [];
      for (const p of projects) {
        const it = p.items.find((i) => i.month === mo.key && i.concept === concept && i.cell === mo.letter + (p.row + off));
        if (it && !refs.has(p.row + off) && !refs.has(p.row)) faltan.push({ code: p.code, name: p.name, cell: it.cell, amount: it.amount });
        if (refs.has(p.row)) sobran.push({ code: p.code, name: p.name, cell: mo.letter + p.row });
      }
      if (faltan.length || sobran.length) e.breakdown.push({ row: r0 + 1, label: lab, faltan, sobran });
    }
    excel[mo.key] = e;
  }

  return {
    sheet: ws.name,
    months: months.map((m) => m.key),
    projects,
    excel,
    rows: {
      real: rowReal != null ? rowReal + 1 : null,
      total: rowTotal != null ? rowTotal + 1 : null,
      proy: rowProy != null ? rowProy + 1 : null,
    },
  };
}

export async function getFacturacionData(): Promise<FacturacionData> {
  const wb = await loadWorkbook(FACTURACION_FILE_ID);
  return parseFacturacionSheet(wb);
}
