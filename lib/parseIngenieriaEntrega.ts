import { loadWorkbook, rowsWithFills } from "./driveFile";
import { fmtDate, str, stepValue } from "./parseCertificacion";

/** Same workbook as Certificación (Certificacion_Refacciones_v2.xlsx); this module reads its "Ingenieria" and "Entrega" sheets. */
const FILE_ID = process.env.CERTIFICACION_FILE_ID || "1uLIaDCKqi2zaFBIPILfb8Ja8vv2BOtnq";

export interface PasoDef {
  label: string;
  grupo: string;
}

export interface FilaSeguimiento {
  proyecto: string;
  /** Info columns (vendedor, cliente, mantenedor…) in the same order as `SeccionConfig.info`. */
  info: (string | null)[];
  /** One value per step: "✓", "⏳", "✗", "—", other text, or null (pending). */
  pasos: (string | null)[];
  /** Date written in the sheet for each step (by step index), shown as tooltip. */
  fechas: Record<number, string>;
  comentario: string | null;
  pctAvance: number;
}

export interface SeccionData {
  id: "ingenieria" | "entrega";
  titulo: string;
  descripcion: string;
  pasosDef: PasoDef[];
  infoLabels: string[];
  filas: FilaSeguimiento[];
}

export interface IngenieriaEntregaData {
  ingenieria: SeccionData;
  entrega: SeccionData;
}

interface SeccionConfig {
  id: SeccionData["id"];
  titulo: string;
  descripcion: string;
  sheet: string;
  /** 0-based column indexes */
  info: { label: string; col: number }[];
  pasos: { label: string; grupo: string; col: number }[];
  comentarioCol: number;
}

const CONFIG: SeccionConfig[] = [
  {
    id: "ingenieria",
    titulo: "Ingeniería",
    descripcion: "Seguimiento de ingeniería por proyecto: contrato, planos y documentos técnicos.",
    sheet: "Ingenieria",
    info: [{ label: "Vendedor", col: 1 }],
    pasos: [
      { label: "Traspaso", grupo: "Contrato", col: 2 },
      { label: "Gantt Metrogas", grupo: "Contrato", col: 3 },
      { label: "Reunión Inicio", grupo: "Contrato", col: 4 },
      { label: "Anticipo 50%", grupo: "Contrato", col: 5 },
      { label: "Visita Inicial", grupo: "Contrato", col: 6 },
      { label: "Carta Gantt", grupo: "Contrato", col: 7 },
      { label: "Reunión de Ingeniería", grupo: "Contrato", col: 8 },
      { label: "Reunión Tableros", grupo: "Ingeniería", col: 9 },
      { label: "Entrega EETT", grupo: "Ingeniería", col: 10 },
      { label: "Diagrama Hidráulico", grupo: "Ingeniería", col: 11 },
      { label: "Plano RBP", grupo: "Ingeniería", col: 12 },
      { label: "Plano Eléctrico", grupo: "Ingeniería", col: 13 },
      { label: "Distribución", grupo: "Ingeniería", col: 14 },
    ],
    comentarioCol: 15,
  },
  {
    id: "entrega",
    titulo: "Entrega y puesta en régimen",
    descripcion: "Seguimiento de entrega al cliente, traspaso a mantención y posventa.",
    sheet: "Entrega",
    info: [
      { label: "Cliente mantención", col: 1 },
      { label: "Mantenedor", col: 2 },
      { label: "Fecha GIO", col: 3 },
      { label: "¿Garantías abiertas?", col: 16 },
    ],
    pasos: [
      { label: "Revisión GIO", grupo: "Entrega", col: 4 },
      { label: "Certificación", grupo: "Entrega", col: 5 },
      { label: "Facturación 35%", grupo: "Entrega", col: 6 },
      { label: "Informe Interno", grupo: "Entrega", col: 7 },
      { label: "Documento Entrega", grupo: "Entrega", col: 8 },
      { label: "Traspaso Técnico", grupo: "Entrega", col: 9 },
      { label: "Capacitación Edificio", grupo: "Puesta en régimen", col: 10 },
      { label: "1° Mantención", grupo: "Puesta en régimen", col: 11 },
      { label: "Feedback Mantenedor", grupo: "Puesta en régimen", col: 12 },
      { label: "Informe de Eficiencia", grupo: "Puesta en régimen", col: 13 },
      { label: "Cliente Recibe", grupo: "Puesta en régimen", col: 14 },
      { label: "Posventa 12 meses", grupo: "Puesta en régimen", col: 15 },
    ],
    comentarioCol: 17,
  },
];

function txt(v: unknown): string | null {
  return v instanceof Date ? fmtDate(v) : str(v);
}

function parseSeccion(cfg: SeccionConfig, sheet: import("exceljs").Worksheet | undefined): SeccionData {
  const base: SeccionData = {
    id: cfg.id,
    titulo: cfg.titulo,
    descripcion: cfg.descripcion,
    pasosDef: cfg.pasos.map((p) => ({ label: p.label, grupo: p.grupo })),
    infoLabels: cfg.info.map((i) => i.label),
    filas: [],
  };
  if (!sheet) throw new Error(`No se encontró la hoja "${cfg.sheet}" en el archivo de certificación.`);

  const { rows } = rowsWithFills(sheet, 20);
  // Rows 1-4 are title, responsable, group header and column header; data starts at row 5.
  for (let r = 4; r < rows.length; r++) {
    const row = rows[r];
    const proyecto = str(row[0]);
    if (proyecto && /RESUMEN|LEYENDA/i.test(proyecto)) break;
    if (!proyecto) continue;

    const steps = cfg.pasos.map((p) => stepValue(row[p.col]));
    const fechas: Record<number, string> = {};
    steps.forEach((x, i) => {
      if (x.fecha) fechas[i] = x.fecha;
    });
    const completados = steps.filter((x) => x.value === "✓").length;

    base.filas.push({
      proyecto,
      info: cfg.info.map((i) => txt(row[i.col])),
      pasos: steps.map((x) => x.value),
      fechas,
      comentario: txt(row[cfg.comentarioCol]),
      pctAvance: completados / cfg.pasos.length,
    });
  }
  return base;
}

export async function getIngenieriaEntregaData(): Promise<IngenieriaEntregaData> {
  const workbook = await loadWorkbook(FILE_ID);
  const [ing, ent] = CONFIG;
  return {
    ingenieria: parseSeccion(ing, workbook.getWorksheet(ing.sheet)),
    entrega: parseSeccion(ent, workbook.getWorksheet(ent.sheet)),
  };
}
