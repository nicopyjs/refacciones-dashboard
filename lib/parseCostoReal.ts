import type ExcelJS from "exceljs";
import { cellValue } from "./driveFile";

// Estado del costo según el color de la letra en la hoja "Costo real":
// naranjo = ya pagado, morado = futuro / proyectado. Letra negra (2025) = pagado.
export type CostoStatus = "pag" | "proy";
export type CostoCategory = "Materiales" | "Mano de obra" | "Certificación" | "Obras civiles";

export const COSTO_CATEGORIES: CostoCategory[] = ["Materiales", "Mano de obra", "Certificación", "Obras civiles"];

export interface CostoItem {
  month: string;
  category: CostoCategory;
  amount: number;
  status: CostoStatus;
  cell: string;
}

export interface CostoProject {
  row: number;
  code: string;
  name: string;
  full: string;
  budget: number | null; // columna "Costo total" (presupuesto, viene de la hoja Costos)
  items: CostoItem[];
}

export interface CostoRealData {
  sheet: string;
  months: string[];
  projects: CostoProject[];
}

const PURPLE = "7030A0";

function categoryOf(s: string): CostoCategory | null {
  const t = s.toLowerCase();
  if (t.startsWith("material")) return "Materiales";
  if (t.startsWith("mano de obra")) return "Mano de obra";
  if (t.startsWith("certific")) return "Certificación";
  if (t.startsWith("obras civiles")) return "Obras civiles";
  return null;
}

function colLetter(c: number): string {
  let s = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function fontStatus(c: ExcelJS.Cell): CostoStatus {
  const argb = c.font?.color?.argb;
  return argb && argb.slice(-6).toUpperCase() === PURPLE ? "proy" : "pag";
}

export function parseCostoRealSheet(wb: ExcelJS.Workbook): CostoRealData {
  const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === "costo real");
  if (!ws) throw new Error('No se encontró la pestaña "Costo real"');

  const lastRow = ws.rowCount;
  const lastCol = ws.columnCount - 1; // 0-based
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

  const months: { col: number; key: string; letter: string }[] = [];
  for (let c = 1; c <= lastCol; c++) {
    const h = val(0, c);
    if (!(h instanceof Date)) continue;
    months.push({ col: c, key: `${h.getUTCFullYear()}-${String(h.getUTCMonth() + 1).padStart(2, "0")}`, letter: colLetter(c) });
  }

  const projects: CostoProject[] = [];
  let cur: CostoProject | null = null;
  for (let r = 1; r < lastRow; r++) {
    const label = txt(r, 0);
    if (!label) continue;
    if (/^ajuste/i.test(label)) break; // desde aquí vienen los totales y el estado de resultado
    const cat = categoryOf(label);
    // Bloque de costo = fila de proyecto seguida de una línea "Materiales".
    if (!cat) {
      cur = null;
      if (categoryOf(txt(r + 1, 0)) === "Materiales") {
        const m = label.match(/^(RCT[A-Z]?\s?\d+)\s*-\s*(.+)$/i);
        const budget = num(r, 13); // N
        cur = {
          row: r + 1,
          code: m ? m[1].replace(/\s/g, "") : "",
          name: m ? m[2].trim() : label,
          full: label,
          budget: budget || null,
          items: [],
        };
        projects.push(cur);
      }
      continue;
    }
    if (!cur) continue;
    for (const mo of months) {
      const c = cell(r, mo.col);
      const v = num(r, mo.col);
      if (!v) continue;
      cur.items.push({
        month: mo.key,
        category: cat,
        amount: Math.round(v),
        status: fontStatus(c),
        cell: mo.letter + (r + 1),
      });
    }
  }

  return { sheet: ws.name, months: months.map((m) => m.key), projects };
}
