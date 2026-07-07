import { loadWorkbook, rowsWithFills } from "./driveFile";

export interface ObraEntrega {
  obra: string;
  comunidad: string | null;
  entregado: boolean | null;
  fechaEntrega: string | null;
  fechaGarantia: string | null;
  duracionInstalacionAnios: number | null;
  duracionCalderaAnios: number | null;
  responsable: string | null;
  observacion: string | null;
  capacitacion: string | null;
  seremi: string | null;
}

export interface ObraEspecificacion {
  obra: string;
  comunidad: string | null;
  centroNegocio: string | null;
  potencia: string | null;
  acumulacion: string | null;
  intercambio: string | null;
  distribucionModelo: string | null;
  distribucionTag: string | null;
  electrico: string | null;
  control: string | null;
}

export interface RefaccionesData {
  obras: ObraEntrega[];
  especificaciones: ObraEspecificacion[];
}

const GESTION_FILE_ID = process.env.GESTION_FILE_ID || "186eIeAKYWP2X7psdCZldoRKHxQX8PlqD";

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function bool(v: unknown): boolean | null {
  const s = str(v);
  if (!s) return null;
  const up = s.toUpperCase();
  if (up === "SI" || up === "SÍ") return true;
  if (up === "NO") return false;
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return v;
  return null;
}

function isoDate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}

export async function getRefaccionesData(): Promise<RefaccionesData> {
  const workbook = await loadWorkbook(GESTION_FILE_ID);

  const sheet1 = workbook.getWorksheet("DATOS OBRAS REFACCIONES") ?? workbook.worksheets[0];
  const { rows: rows1 } = rowsWithFills(sheet1, 11);

  const obras: ObraEntrega[] = [];
  for (let r = 1; r < rows1.length; r++) {
    const row = rows1[r];
    const obra = str(row[0]);
    if (!obra) continue;
    obras.push({
      obra,
      comunidad: str(row[1]),
      entregado: bool(row[2]),
      fechaEntrega: isoDate(row[3]),
      fechaGarantia: isoDate(row[4]),
      duracionInstalacionAnios: num(row[5]),
      duracionCalderaAnios: num(row[6]),
      responsable: str(row[7]),
      observacion: str(row[8]),
      capacitacion: str(row[9]),
      seremi: str(row[10]),
    });
  }

  const sheet2 = workbook.getWorksheet("Vista General REF") ?? workbook.worksheets[1];
  const { rows: rows2 } = rowsWithFills(sheet2, 10);

  const especificaciones: ObraEspecificacion[] = [];
  // row 0 = main headers, row 1 = sub-headers (MODELO / TAG under DISTRIBUCCION) — data starts row 2
  for (let r = 2; r < rows2.length; r++) {
    const row = rows2[r];
    const obra = str(row[0]);
    if (!obra) continue;
    especificaciones.push({
      obra,
      comunidad: str(row[1]),
      centroNegocio: str(row[2]),
      potencia: str(row[3]),
      acumulacion: str(row[4]),
      intercambio: str(row[5]),
      distribucionModelo: str(row[6]),
      distribucionTag: str(row[7]),
      electrico: str(row[8]),
      control: str(row[9]),
    });
  }

  return { obras, especificaciones };
}
