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

// Resumen mensual del final de la hoja (filas "Facturación" … "Utilidad acumulada").
// Se ubican por la etiqueta de la columna A, no por número de fila, porque la hoja se edita seguido.
export interface CostoResumenMes {
  facturacion: number;
  costoDirecto: number; // fila "Costo sin Mano de obra" (= TOTAL de los proyectos, incluye mano de obra)
  indirectos: number; // fila "Costo Indirectos"
  otrosIndirectos: number; // fila "Otros indirectos"
  indirectoTotal: number; // fila "Costo Total indirecto" = indirectos + otros
  costoTotal: number; // directo + indirecto total (la hoja lo trae en "Costo Total")
  utilidad: number; // facturación − costo total
  hojaCostoTotal: number | null; // lo que dice la hoja, para validar
  hojaUtilidad: number | null;
}

export interface CostoRealData {
  sheet: string;
  months: string[];
  projects: CostoProject[];
  resumen: Record<string, CostoResumenMes>; // solo meses con algún dato en el resumen
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

  return { sheet: ws.name, months: months.map((m) => m.key), projects, resumen: parseResumen(months, lastRow, txt, val) };
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function parseResumen(
  months: { col: number; key: string }[],
  lastRow: number,
  txt: (r: number, c: number) => string,
  val: (r: number, c: number) => unknown
): Record<string, CostoResumenMes> {
  // El resumen parte en la fila "Ajuste"; antes de eso hay filas con nombres parecidos por proyecto.
  let start = -1;
  for (let r = 1; r < lastRow; r++) if (/^ajuste/i.test(txt(r, 0))) { start = r; break; }
  if (start < 0) return {};

  const rows: Record<string, number> = {};
  const set = (k: string, r: number) => { if (!(k in rows)) rows[k] = r; };
  for (let r = start; r < lastRow; r++) {
    const l = norm(txt(r, 0));
    if (!l) continue;
    if (l === "facturacion") set("fact", r);
    else if (l.startsWith("costo sin mano de obra")) set("directo", r);
    else if (l.startsWith("costo ind")) set("ind", r); // la hoja escribe "Costo Indrectos"
    else if (l.startsWith("otros indirectos")) set("otros", r);
    else if (l.startsWith("costo total indirecto")) set("indTot", r);
    else if (l === "costo total") set("total", r);
    else if (l === "utilidad") set("util", r);
  }
  if (rows.fact == null && rows.directo == null) return {};

  const get = (k: string, c: number): number | null => {
    const r = rows[k];
    if (r == null) return null;
    const v = val(r, c);
    return typeof v === "number" && isFinite(v) ? v : null;
  };

  const out: Record<string, CostoResumenMes> = {};
  for (const mo of months) {
    const fact = get("fact", mo.col), dir = get("directo", mo.col), ind = get("ind", mo.col), otros = get("otros", mo.col), indTot = get("indTot", mo.col);
    if (fact == null && dir == null && ind == null && otros == null && indTot == null) continue;
    const indirectoTotal = indTot ?? (ind ?? 0) + (otros ?? 0);
    const costoTotal = (dir ?? 0) + indirectoTotal;
    out[mo.key] = {
      facturacion: fact ?? 0,
      costoDirecto: dir ?? 0,
      indirectos: ind ?? 0,
      otrosIndirectos: otros ?? 0,
      indirectoTotal,
      costoTotal,
      utilidad: (fact ?? 0) - costoTotal,
      hojaCostoTotal: get("total", mo.col),
      hojaUtilidad: get("util", mo.col),
    };
  }
  return out;
}
