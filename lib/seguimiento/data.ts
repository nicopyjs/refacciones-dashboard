import ExcelJS from "exceljs";
import { cellValue, fetchWorkbookBuffer } from "../driveFile";
import { authFetch } from "../rct/sources";
import type { SegEdificio, SegEstado, SegEtapa, SeguimientoData } from "./types";

// Excel «Seguimiento de contratos por edificio» (xlsx en Drive, compartido con la cuenta de servicio).
const SEG_FILE_ID = process.env.SEGUIMIENTO_FILE_ID || "1005Y6wrJHIF1kl0Ri9Z_Cpx8i_cO7LtB";

const SH_SEG = "Seguimiento";
const SH_ETAPAS = "Etapas";

const FRESH_MS = 10 * 60 * 1000;
let cache: { at: number; data: SeguimientoData } | null = null;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null || typeof v === "object" ? "" : String(v).trim());
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Excel guarda las fechas a medianoche UTC. */
function ymd(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

function sheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`El Excel de seguimiento de contratos cambió de formato: falta la hoja «${name}».`);
  return ws;
}

async function descargar(): Promise<ArrayBuffer> {
  try {
    return await (await authFetch(`https://www.googleapis.com/drive/v3/files/${SEG_FILE_ID}?alt=media`)).arrayBuffer();
  } catch {
    return fetchWorkbookBuffer(SEG_FILE_ID);
  }
}

/** Hoy en Chile como día calendario (UTC medianoche), para restar contra las fechas del Excel. */
function hoyChile(): number {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date()).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export async function computeSeguimientoData(): Promise<SeguimientoData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await descargar()) as unknown as ArrayBuffer);

  // ── Etapas (tabla de referencia) ──
  const we = sheet(wb, SH_ETAPAS);
  const etapas: SegEtapa[] = [];
  let diasMaxEtapa = 14;
  for (let r = 1; r <= we.rowCount; r++) {
    const a = cellValue(we.getCell(r, 1));
    const etapa = str(cellValue(we.getCell(r, 3)));
    if (str(a).toLowerCase().startsWith("días máximos")) {
      diasMaxEtapa = numOrNull(cellValue(we.getCell(r, 4))) ?? diasMaxEtapa;
    }
    if (typeof a !== "number" || !etapa) continue;
    const paso = numOrNull(cellValue(we.getCell(r, 2))) ?? a;
    etapas.push({
      orden: a,
      paso,
      etapa,
      area: str(cellValue(we.getCell(r, 4))),
      tipo: str(cellValue(we.getCell(r, 5))),
      // Los avances son fórmulas; si el Excel no trae el resultado guardado se recalcula igual que él.
      avance: numOrNull(cellValue(we.getCell(r, 6))) ?? Math.min(1, (paso - 1) / 15),
      siguiente: str(cellValue(we.getCell(r, 7))),
    });
  }
  if (etapas.length === 0) throw new Error("No se encontró la tabla de etapas en el Excel de seguimiento de contratos.");
  const etapaPor = new Map(etapas.map((e) => [e.etapa, e]));

  // ── Seguimiento: solo se leen las columnas que se digitan; el resto se calcula aquí ──
  const ws = sheet(wb, SH_SEG);
  let hdr = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
    if (str(cellValue(ws.getCell(r, 2))) === "Edificio") { hdr = r; break; }
  }
  if (!hdr) throw new Error("El Excel de seguimiento de contratos cambió de formato: no se encontró la fila de encabezados.");

  const hoy = hoyChile();
  const edificios: SegEdificio[] = [];
  for (let r = hdr + 1; r <= ws.rowCount; r++) {
    const edificio = str(cellValue(ws.getCell(r, 2)));
    if (!edificio) continue;
    const etapaNombre = str(cellValue(ws.getCell(r, 7)));
    const et = etapaPor.get(etapaNombre);
    const ultimoMov = ymd(cellValue(ws.getCell(r, 11)));
    const completo = etapaNombre === "Proceso completo";
    const dias = ultimoMov && !completo && etapaNombre ? Math.round((hoy - Date.parse(ultimoMov)) / 86400000) : null;

    let estado: SegEstado | "" = "";
    if (et) {
      estado = completo ? "Completo" : et.tipo === "Rechazo" ? "En rechazo" : dias != null && dias > diasMaxEtapa ? "Atrasado" : "En curso";
    }

    edificios.push({
      n: edificios.length + 1,
      edificio,
      direccion: str(cellValue(ws.getCell(r, 3))),
      comuna: str(cellValue(ws.getCell(r, 4))),
      prospecto: str(cellValue(ws.getCell(r, 5))),
      inicio: ymd(cellValue(ws.getCell(r, 6))),
      etapa: etapaNombre,
      paso: et?.paso ?? null,
      area: et?.area ?? "",
      avance: et?.avance ?? 0,
      ultimoMov,
      dias,
      estado,
      contratoObra: str(cellValue(ws.getCell(r, 14))),
      contratoMant: str(cellValue(ws.getCell(r, 15))),
      siguiente: et?.siguiente ?? "",
      responsable: str(cellValue(ws.getCell(r, 17))),
      observaciones: str(cellValue(ws.getCell(r, 18))),
    });
  }

  const count = (e: SegEstado) => edificios.filter((x) => x.estado === e).length;
  const conEtapa = edificios.filter((x) => x.etapa);
  const areas: string[] = [];
  for (const e of etapas) if (e.area !== "—" && !areas.includes(e.area)) areas.push(e.area);

  return {
    generatedAt: new Date().toISOString(),
    diasMaxEtapa,
    edificios,
    etapas,
    resumen: {
      total: edificios.length,
      enCurso: count("En curso"),
      atrasados: count("Atrasado"),
      enRechazo: count("En rechazo"),
      completos: count("Completo"),
      avancePromedio: conEtapa.length ? conEtapa.reduce((s, x) => s + x.avance, 0) / conEtapa.length : 0,
      ambosFirmados: edificios.filter((x) => x.contratoObra === "Sí" && x.contratoMant === "Sí").length,
    },
    porEtapa: etapas.map((e) => ({ etapa: e.etapa, paso: e.paso, area: e.area, n: edificios.filter((x) => x.etapa === e.etapa).length })),
    porArea: areas.map((area) => ({ area, n: edificios.filter((x) => x.area === area && x.estado !== "Completo").length })),
  };
}

/** Datos del Excel con cache en memoria de 10 minutos. */
export async function getSeguimientoData(): Promise<SeguimientoData> {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.data;
  const data = await computeSeguimientoData();
  cache = { at: Date.now(), data };
  return data;
}
