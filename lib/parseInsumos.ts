import { loadWorkbook, rowsWithFills } from "./driveFile";

export interface InsumoItem {
  numero: number | null;
  material: string;
  especificacion: string | null;
  unidad: string | null;
}

export interface InsumoCategoria {
  slug: string;
  nombre: string;
  hoja: string;
  items: InsumoItem[];
}

// The three specialties are the first three sheets of the workbook, in this
// order. We map by sheet index (not name) because the sheet tabs have no
// accents ("Electricos", "Hidraulico") and could be renamed.
export const CATEGORIAS = [
  { slug: "electricos", nombre: "Eléctricos" },
  { slug: "terminaciones", nombre: "Terminaciones" },
  { slug: "hidraulico", nombre: "Hidráulico" },
] as const;

const INSUMOS_FILE_ID = process.env.INSUMOS_FILE_ID || "1yE16hu8Bi2Z5CWsSa0woPKg47_E7M-Sf";

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s === "—" || s === "-") return null;
  return s;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return v;
  const s = typeof v === "string" ? v.trim() : "";
  return /^\d+$/.test(s) ? Number(s) : null;
}

export function getCategoria(slug: string): { slug: string; nombre: string } | undefined {
  return CATEGORIAS.find((c) => c.slug === slug);
}

export async function getInsumosData(): Promise<InsumoCategoria[]> {
  const workbook = await loadWorkbook(INSUMOS_FILE_ID);

  return CATEGORIAS.map((cat, i) => {
    const sheet = workbook.worksheets[i];
    if (!sheet) return { ...cat, hoja: "", items: [] };

    // A = N°, B = Material, C = Especificación, D = Cantidad (blank, filled in
    // the UI), E = Medición/unidad (only populated for Hidráulico).
    const { rows } = rowsWithFills(sheet, 5);
    const items: InsumoItem[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const material = str(row[1]);
      if (!material) continue;
      items.push({
        numero: num(row[0]),
        material,
        especificacion: str(row[2]),
        unidad: str(row[4]),
      });
    }
    return { ...cat, hoja: sheet.name, items };
  });
}
