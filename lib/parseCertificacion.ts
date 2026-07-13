import { loadWorkbook, rowsWithFills } from "./driveFile";

export interface ProyectoCertificacion {
  proyecto: string;
  contrato: string | null;
  primeraVisita: string | null;
  informe: string | null;
  segundaVisita: string | null;
  selloVerde: string | null;
  informeTC5: string | null;
  tc5: string | null;
  te1: string | null;
  operador: string | null;
  primeraInspeccionSeremi: string | null;
  segundaInspeccionSeremi: string | null;
  inscritoSeremi: string | null;
  carta35: string | null;
  carta15: string | null;
  pctAvance: number;
  estadoGeneral: string | null;
}

export interface RechazoSeremi {
  edificio: string;
  codigoRcta: string | null;
  fechaRechazo: string | null;
  razon: string | null;
  estado: string | null;
  planAccion: string | null;
  fechaReingreso: string | null;
  responsable: string | null;
  notaAdicional: string | null;
}

export interface CertificacionData {
  proyectos: ProyectoCertificacion[];
  rechazos: RechazoSeremi[];
}

const CERTIFICACION_FILE_ID = process.env.CERTIFICACION_FILE_ID || "1uLIaDCKqi2zaFBIPILfb8Ja8vv2BOtnq";

// Columns 2-14 of the "Certificación" sheet are the pass/fail checklist steps
// (1° Visita … Carta 15%). % Avance is recomputed from these rather than trusting
// the sheet's cached formula result, which is sometimes missing for shared-formula rows.
const CHECK_COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export async function getCertificacionData(): Promise<CertificacionData> {
  const workbook = await loadWorkbook(CERTIFICACION_FILE_ID);

  const sheet1 = workbook.getWorksheet("Certificación") ?? workbook.worksheets[0];
  const { rows: rows1 } = rowsWithFills(sheet1, 18);

  const proyectos: ProyectoCertificacion[] = [];
  for (let r = 4; r < rows1.length; r++) {
    const row = rows1[r];
    const proyecto = str(row[0]);
    // "RESUMEN DEL ÁREA" and the "LEYENDA" block that follow the project rows
    // mark the end of real data — stop instead of skipping so the legend's
    // own content row (e.g. "✓ Completo") never gets parsed as a project.
    if (proyecto && /RESUMEN|LEYENDA/i.test(proyecto)) break;
    if (!proyecto) continue;

    const checks = CHECK_COLS.map((c) => str(row[c]));
    const completados = checks.filter((v) => v === "✓").length;

    proyectos.push({
      proyecto,
      contrato: str(row[1]),
      primeraVisita: str(row[2]),
      informe: str(row[3]),
      segundaVisita: str(row[4]),
      selloVerde: str(row[5]),
      informeTC5: str(row[6]),
      tc5: str(row[7]),
      te1: str(row[8]),
      operador: str(row[9]),
      primeraInspeccionSeremi: str(row[10]),
      segundaInspeccionSeremi: str(row[11]),
      inscritoSeremi: str(row[12]),
      carta35: str(row[13]),
      carta15: str(row[14]),
      pctAvance: completados / CHECK_COLS.length,
      estadoGeneral: str(row[17]),
    });
  }

  const sheet2 = workbook.getWorksheet("Rechazos SEREMI") ?? workbook.worksheets[1];
  const { rows: rows2 } = rowsWithFills(sheet2, 9);

  const rechazos: RechazoSeremi[] = [];
  for (let r = 3; r < rows2.length; r++) {
    const row = rows2[r];
    const edificio = str(row[0]);
    if (!edificio || edificio.startsWith("→")) continue;
    rechazos.push({
      edificio,
      codigoRcta: str(row[1]),
      fechaRechazo: str(row[2]),
      razon: str(row[3]),
      estado: str(row[4]),
      planAccion: str(row[5]),
      fechaReingreso: str(row[6]),
      responsable: str(row[7]),
      notaAdicional: str(row[8]),
    });
  }

  return { proyectos, rechazos };
}
