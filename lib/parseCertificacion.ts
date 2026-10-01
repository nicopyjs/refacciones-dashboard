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
  inscribirTE1: string | null;
  te1: string | null;
  operador: string | null;
  primerPasoRL: string | null;
  segundoPasoRL: string | null;
  inscritoSeremi: string | null;
  visitaSeremi: string | null;
  aprobacionSeremi: string | null;
  cartasSolicitadas: string | null;
  carta35: string | null;
  carta15: string | null;
  fechaCarta: string | null;
  pctAvance: number;
  estadoGeneral: string | null;
}

export type PasoKey =
  | "primeraVisita" | "informe" | "segundaVisita" | "selloVerde" | "informeTC5" | "tc5" | "inscribirTE1" | "te1" | "operador"
  | "primerPasoRL" | "segundoPasoRL" | "inscritoSeremi" | "visitaSeremi" | "aprobacionSeremi"
  | "cartasSolicitadas" | "carta35" | "carta15";

export type GrupoPaso = "SEC" | "SEREMI" | "Metrogas";

/** The 17 checklist steps of the "Certificación" sheet, in column order (C..S). */
export const PASOS: { key: PasoKey; label: string; grupo: GrupoPaso }[] = [
  { key: "primeraVisita", label: "1° Visita", grupo: "SEC" },
  { key: "informe", label: "Informe", grupo: "SEC" },
  { key: "segundaVisita", label: "2° Visita", grupo: "SEC" },
  { key: "selloVerde", label: "Sello Verde", grupo: "SEC" },
  { key: "informeTC5", label: "Informe TC5", grupo: "SEC" },
  { key: "tc5", label: "TC5", grupo: "SEC" },
  { key: "inscribirTE1", label: "Inscribir TE1", grupo: "SEC" },
  { key: "te1", label: "TE1", grupo: "SEC" },
  { key: "operador", label: "Operador", grupo: "SEC" },
  { key: "primerPasoRL", label: "1° Paso RL SEREMI", grupo: "SEREMI" },
  { key: "segundoPasoRL", label: "2° Paso RL SEREMI", grupo: "SEREMI" },
  { key: "inscritoSeremi", label: "Inscrito en SEREMI", grupo: "SEREMI" },
  { key: "visitaSeremi", label: "Visita SEREMI", grupo: "SEREMI" },
  { key: "aprobacionSeremi", label: "Aprobación u Observaciones", grupo: "SEREMI" },
  { key: "cartasSolicitadas", label: "Solicitadas a Metrogas", grupo: "Metrogas" },
  { key: "carta35", label: "Carta 35% firmada", grupo: "Metrogas" },
  { key: "carta15", label: "Carta 15% firmada", grupo: "Metrogas" },
];

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

// Columns 2-18 of the "Certificación" sheet are the pass/fail checklist steps
// (1° Visita … Firmada Carta 15%). % Avance is recomputed from these rather than trusting
// the sheet's cached formula (it divides by 16 and can exceed 100%, and is missing for
// shared-formula rows).
const CHECK_COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  // The sheet marks rejected steps with a plain "X" although its legend says ✗.
  return /^x$/i.test(s) ? "✗" : s;
}

export async function getCertificacionData(): Promise<CertificacionData> {
  const workbook = await loadWorkbook(CERTIFICACION_FILE_ID);

  const sheet1 = workbook.getWorksheet("Certificación") ?? workbook.worksheets[0];
  const { rows: rows1 } = rowsWithFills(sheet1, 22);

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
      primeraVisita: checks[0],
      informe: checks[1],
      segundaVisita: checks[2],
      selloVerde: checks[3],
      informeTC5: checks[4],
      tc5: checks[5],
      inscribirTE1: checks[6],
      te1: checks[7],
      operador: checks[8],
      primerPasoRL: checks[9],
      segundoPasoRL: checks[10],
      inscritoSeremi: checks[11],
      visitaSeremi: checks[12],
      aprobacionSeremi: checks[13],
      cartasSolicitadas: checks[14],
      carta35: checks[15],
      carta15: checks[16],
      fechaCarta: str(row[19]),
      pctAvance: completados / CHECK_COLS.length,
      estadoGeneral: str(row[21]),
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
