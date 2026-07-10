import { loadWorkbook, rowsWithFills } from "./driveFile";

export interface Observacion {
  numero: number | null;
  proyecto: string;
  origen: string | null;
  fechaDeteccion: string | null;
  descripcion: string | null;
  responsable: string | null;
  prioridad: string | null;
  estado: string | null;
  fechaCompromiso: string | null;
  fechaResolucion: string | null;
  diasAbiertos: number | null;
  evidenciaFotografica: string | null;
  comentarios: string | null;
}

const OBSERVACIONES_FILE_ID = process.env.OBSERVACIONES_FILE_ID || "10xpKbj_HmFpoWh8bbw3UQgfnyAp7Ed30";

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function isoDate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}

export async function getObservaciones(): Promise<Observacion[]> {
  const workbook = await loadWorkbook(OBSERVACIONES_FILE_ID);
  const sheet = workbook.getWorksheet("Seguimiento") ?? workbook.worksheets[0];
  const { rows } = rowsWithFills(sheet, 13);

  const observaciones: Observacion[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const proyecto = str(row[1]);
    if (!proyecto) continue;
    observaciones.push({
      numero: num(row[0]),
      proyecto,
      origen: str(row[2]),
      fechaDeteccion: isoDate(row[3]),
      descripcion: str(row[4]),
      responsable: str(row[5]),
      prioridad: str(row[6]),
      estado: str(row[7]),
      fechaCompromiso: isoDate(row[8]),
      fechaResolucion: isoDate(row[9]),
      diasAbiertos: num(row[10]),
      evidenciaFotografica: str(row[11]),
      comentarios: str(row[12]),
    });
  }

  return observaciones;
}
