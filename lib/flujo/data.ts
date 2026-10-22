import ExcelJS from "exceljs";
import { cellValue, fetchWorkbookBuffer } from "../driveFile";
import { authFetch } from "../rct/sources";
import type { FlujoData, FlujoFacturaFila, FlujoProyecto } from "./types";

// Excel «Flujos de caja C - Consolidado» (xlsx en Drive, compartido con enlace).
const FLUJO_FILE_ID = process.env.FLUJO_FILE_ID || "1Hv8l5H6wXFC5kDZ10FW7J_o1aCMQzoIY";

const SH_CONSOL = "FLUJO CONSOLIDADO";
const SH_PARAMS = "PARÁMETROS";
const SH_FACT = "FACTURACIÓN PENDIENTE";

const FRESH_MS = 10 * 60 * 1000;
let cache: { at: number; data: FlujoData } | null = null;

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/** Excel guarda el 1º de cada mes a medianoche UTC. */
function ym(v: unknown): string | null {
  if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
  return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`El Excel de flujo de caja cambió de formato: falta la hoja «${name}».`);
  return ws;
}

/** Cuenta de servicio (archivo compartido con ella); si falla, enlace público. */
async function descargar(): Promise<ArrayBuffer> {
  try {
    return await (await authFetch(`https://www.googleapis.com/drive/v3/files/${FLUJO_FILE_ID}?alt=media`)).arrayBuffer();
  } catch {
    return fetchWorkbookBuffer(FLUJO_FILE_ID);
  }
}

export async function computeFlujoData(): Promise<FlujoData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await descargar()) as unknown as ArrayBuffer);
  const ws = sheet(wb, SH_CONSOL);

  // Etiquetas de la columna B, en orden, para ubicar cada fila sin depender de su número.
  const labels: string[] = [];
  for (let r = 1; r <= ws.rowCount; r++) labels[r] = str(cellValue(ws.getCell(r, 2)));
  const findFrom = (from: number, test: (s: string) => boolean): number => {
    for (let r = from; r < labels.length; r++) if (test(labels[r] ?? "")) return r;
    throw new Error("El Excel de flujo de caja cambió de formato: no se encontró una de las secciones esperadas.");
  };

  const hdr = findFrom(1, (s) => s.startsWith("Concepto (CLP"));
  const months: string[] = [];
  const cols: number[] = [];
  for (let c = 3; c <= ws.columnCount; c++) {
    const m = ym(cellValue(ws.getCell(hdr, c)));
    if (m) { months.push(m); cols.push(c); }
  }
  if (months.length === 0) throw new Error("No se encontraron los meses del calendario en el Excel de flujo de caja.");

  const series = (r: number): number[] => cols.map((c) => num(cellValue(ws.getCell(r, c))));

  const sCaja = findFrom(hdr, (s) => s === "RESUMEN POR CONCEPTO");
  const sFlujoProy = findFrom(sCaja, (s) => s === "FLUJO NETO POR PROYECTO");
  const sRent = findFrom(sFlujoProy, (s) => s.startsWith("RENTABILIDAD (SIN IVA)"));
  const sResProy = findFrom(sRent, (s) => s === "RESULTADO POR PROYECTO (SIN IVA)");
  const sNotas = findFrom(sResProy, (s) => s === "NOTAS Y SUPUESTOS");

  const rowCaja = (label: string) => series(findFrom(sCaja, (s) => s.startsWith(label)));
  const rowRent = (label: string) => series(findFrom(sRent, (s) => s.startsWith(label)));

  // Bloques por proyecto: desde el encabezado hasta «Proyectos entregados».
  const porProyecto = (start: number): Map<string, number[]> => {
    const out = new Map<string, number[]>();
    for (let r = start + 1; r < labels.length; r++) {
      const l = labels[r] ?? "";
      if (l.startsWith("Proyectos entregados")) break;
      if (l) out.set(l, series(r));
    }
    return out;
  };
  const flujoProy = porProyecto(sFlujoProy);
  const rentProy = porProyecto(sResProy);

  // ── PARÁMETROS ──
  const wp = sheet(wb, SH_PARAMS);
  const costoIndirectoMensual = num(cellValue(wp.getCell("C6")));
  const proyectos: FlujoProyecto[] = [];
  for (let r = 1; r <= wp.rowCount; r++) {
    const nombre = str(cellValue(wp.getCell(r, 2)));
    const idx = cellValue(wp.getCell(r, 1));
    if (typeof idx !== "number" || !nombre) continue;
    proyectos.push({
      nombre,
      primerPago: ym(cellValue(wp.getCell(r, 3))) ?? "",
      mes1: ym(cellValue(wp.getCell(r, 5))) ?? "",
      ultimo: ym(cellValue(wp.getCell(r, 6))) ?? "",
      flujoNeto: num(cellValue(wp.getCell(r, 7))),
      resultado: num(cellValue(wp.getCell(r, 8))),
      margen: num(cellValue(wp.getCell(r, 9))),
      flujo: flujoProy.get(nombre) ?? months.map(() => 0),
      rent: rentProy.get(nombre) ?? months.map(() => 0),
    });
  }

  // ── FACTURACIÓN PENDIENTE (proyectos entregados) ──
  const wf = sheet(wb, SH_FACT);
  const iva = num(cellValue(wf.getCell("B4"))) || 0.19;
  const desfaseCobro = num(cellValue(wf.getCell("B5"))) || 1;
  const fHdr = findFrom0(wf, (v) => str(v) === "Proyecto");
  const fMonths: { c: number; m: string }[] = [];
  for (let c = 3; c <= wf.columnCount; c++) {
    const m = ym(cellValue(wf.getCell(fHdr, c)));
    if (m) fMonths.push({ c, m });
  }
  const provCol = fMonths.length ? fMonths[fMonths.length - 1].c + 2 : 16;
  const facturacion: FlujoFacturaFila[] = [];
  let proyectoActual = "";
  for (let r = fHdr + 1; r <= wf.rowCount; r++) {
    const a = str(cellValue(wf.getCell(r, 1)));
    const concepto = str(cellValue(wf.getCell(r, 2)));
    const flag = str(cellValue(wf.getCell(r, provCol)));
    if (!concepto || (flag !== "Sí" && flag !== "No")) continue;
    if (a) proyectoActual = a;
    const byMonth = new Map(fMonths.map(({ c, m }) => [m, num(cellValue(wf.getCell(r, c)))]));
    const meses = months.map((m) => byMonth.get(m) ?? 0);
    facturacion.push({ proyecto: a || proyectoActual, concepto, provision: flag === "Sí", total: meses.reduce((s, x) => s + x, 0), meses });
  }

  // Las cuotas con provisionamiento se calculan aquí (no se lee el selector del Excel),
  // así el filtro de la página funciona sin importar cómo esté guardado el archivo.
  const factProv = months.map((_, i) => facturacion.filter((f) => f.provision).reduce((s, f) => s + f.meses[i], 0));
  const provCobro = months.map((_, i) => (i - desfaseCobro >= 0 ? factProv[i - desfaseCobro] * (1 + iva) : 0));

  const notas: string[] = [];
  for (let r = sNotas + 1; r < labels.length; r++) if (labels[r]) notas.push(labels[r]);

  const data: FlujoData = {
    generatedAt: new Date().toISOString(),
    archivo: "Flujos_de_caja.C - Consolidado.xlsx",
    months,
    iva,
    desfaseCobro,
    costoIndirectoMensual,
    cobros: {
      metrogas: rowCaja("Cobro Metrogas"),
      comunidad: rowCaja("Cobro Comunidad"),
      entregados: rowCaja("Cobro proyectos entregados"),
      provision: provCobro,
    },
    pagos: { materiales: rowCaja("Pago materiales"), manoObra: rowCaja("Pago mano de obra") },
    indirecto: rowCaja("Costo indirecto"),
    proyectosEnCurso: rowCaja("N° proyectos en curso"),
    rent: {
      venta: rowRent("Ingresos por venta"),
      entregados: rowRent("Ingresos proyectos entregados"),
      provision: factProv,
      manoObra: rowRent("Mano de obra"),
      materiales: rowRent("Materiales"),
      certificacion: rowRent("Certificación y otros"),
      indirecto: rowRent("Costo indirecto"),
    },
    proyectos,
    facturacion,
    notas,
  };
  return trim(data);
}

function findFrom0(ws: ExcelJS.Worksheet, test: (v: unknown) => boolean): number {
  for (let r = 1; r <= ws.rowCount; r++) if (test(cellValue(ws.getCell(r, 1)))) return r;
  throw new Error("El Excel de flujo de caja cambió de formato: no se encontró la tabla de facturación pendiente.");
}

/** Quita meses vacíos al inicio y al final (el modelo llega a 24 meses, pero la actividad es menor). */
function trim(d: FlujoData): FlujoData {
  const arrays: number[][] = [
    ...Object.values(d.cobros), ...Object.values(d.pagos), d.indirecto, d.proyectosEnCurso, ...Object.values(d.rent),
    ...d.proyectos.flatMap((p) => [p.flujo, p.rent]), ...d.facturacion.map((f) => f.meses),
  ];
  const active = d.months.map((_, i) => arrays.some((a) => Math.abs(a[i] ?? 0) > 0.5));
  const first = active.indexOf(true);
  const last = active.lastIndexOf(true);
  if (first < 0) return d;
  const cut = <T,>(a: T[]) => a.slice(first, last + 1);
  return {
    ...d,
    months: cut(d.months),
    cobros: Object.fromEntries(Object.entries(d.cobros).map(([k, v]) => [k, cut(v)])) as FlujoData["cobros"],
    pagos: Object.fromEntries(Object.entries(d.pagos).map(([k, v]) => [k, cut(v)])) as FlujoData["pagos"],
    indirecto: cut(d.indirecto),
    proyectosEnCurso: cut(d.proyectosEnCurso),
    rent: Object.fromEntries(Object.entries(d.rent).map(([k, v]) => [k, cut(v)])) as FlujoData["rent"],
    proyectos: d.proyectos.map((p) => ({ ...p, flujo: cut(p.flujo), rent: cut(p.rent) })),
    facturacion: d.facturacion.map((f) => ({ ...f, meses: cut(f.meses) })),
  };
}

/** Datos del Excel con cache en memoria de 10 minutos. */
export async function getFlujoData(): Promise<FlujoData> {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.data;
  const data = await computeFlujoData();
  cache = { at: Date.now(), data };
  return data;
}
