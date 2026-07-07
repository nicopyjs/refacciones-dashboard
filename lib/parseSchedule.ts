import ExcelJS from "exceljs";

export interface WeekPerson {
  person: string;
  tasks: (string | null)[];
  sites: (string | null)[];
}

export interface Week {
  monthLabel: string;
  days: (number | null)[];
  people: WeekPerson[];
  sites: string[];
  dates: string[];
  weekdays: string[];
  rangeLabel: string;
}

export interface ScheduleData {
  weeks: Week[];
  siteColors: Record<string, string>;
  specialties: Record<string, string>;
}

const DRIVE_FILE_ID = process.env.DRIVE_FILE_ID || "1GBd9sjukpO8sQb6aTQrQmTOGodptRZDB";
const DRIVE_URL = `https://drive.google.com/uc?export=download&id=${DRIVE_FILE_ID}`;

const MONTH_NUM: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};
const WEEKDAY_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_ABBR_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Raw XML theme-color order (dk1, lt1, dk2, lt2, accent1..6, hlink, folHlink) as Excel
// actually indexes it for cell fills (background/text slots 0-3 swapped vs. document order).
const THEME_HEX = [
  "FFFFFF", "000000", "E7E6E6", "44546A",
  "4472C4", "ED7D31", "A5A5A5", "FFC000",
  "5B9BD5", "70AD47", "0563C1", "954F72",
];

const TASK_ALIASES: Record<string, string> = {
  "pre armado": "Prearmado",
  "prearmado": "Prearmado",
  "canalizacion": "Canalizado",
  "canalizado": "Canalizado",
  "termincaciones": "Terminaciones",
  "terminaciones": "Terminaciones",
  "chimenea": "Chimeneas",
  "chimeneas": "Chimeneas",
  "desarme ventilador": "Desarme (Ventilador)",
  "desarme": "Desarme",
  "corte": "Corte",
  "detalles": "Detalles",
  "despacho": "Despacho",
  "control": "Control",
  "pintura": "Pintura",
  "acumulador": "Acumulador",
  "aislacion": "Aislacion",
  "traslado": "Traslado",
  "victor rae": "Victor Rae",
};

function normalizeTask(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const raw = String(v).trim();
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  return TASK_ALIASES[key] ?? raw;
}

const SPECIALTY_ALIASES: Record<string, string> = {
  "hidraulico": "Hidráulico",
  "electrico": "Eléctrico",
  "terminaciones": "Terminaciones",
  "sub - aislacion": "Sub - Aislación",
  "sub - chatarra": "Sub - Chatarra",
};

function normalizeSpecialty(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const raw = String(v).trim();
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  return SPECIALTY_ALIASES[key] ?? raw;
}

function parseMonths(label: string): number[] {
  const names = Object.keys(MONTH_NUM);
  const found = names.filter((name) => label.toUpperCase().includes(name));
  found.sort((a, b) => label.toUpperCase().indexOf(a) - label.toUpperCase().indexOf(b));
  return found.map((name) => MONTH_NUM[name]);
}

function isBlankRow(row: unknown[] | undefined): boolean {
  if (!row) return true;
  return row.every((c) => c === null || c === undefined || c === "");
}

async function fetchWorkbookBuffer(): Promise<ArrayBuffer> {
  const res = await fetch(DRIVE_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`No se pudo descargar el archivo desde Google Drive (HTTP ${res.status}).`);
  }
  const buf = await res.arrayBuffer();
  const head = new TextDecoder().decode(buf.slice(0, 200)).toLowerCase();
  if (head.includes("<!doctype html") || head.includes("<html")) {
    throw new Error(
      "Google Drive devolvió una página HTML en lugar del archivo. Verifica que el archivo esté compartido como 'Cualquiera con el enlace puede ver'."
    );
  }
  return buf;
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if (v instanceof Date) return v;
    if ("result" in v) return (v as { result: unknown }).result ?? null;
    if ("richText" in v) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
    if ("text" in v) return (v as { text: unknown }).text ?? null;
  }
  return v;
}

function cellFillHex(cell: ExcelJS.Cell): string | null {
  const fill = cell.fill;
  if (!fill || fill.type !== "pattern") return null;
  const fg = (fill as ExcelJS.FillPattern).fgColor;
  if (!fg) return null;
  if (fg.argb) {
    const hex = fg.argb.slice(-6).toUpperCase();
    if (hex === "000000" && fg.argb.length === 8 && fg.argb.slice(0, 2) === "00") return null;
    return hex;
  }
  if (typeof fg.theme === "number" && THEME_HEX[fg.theme]) {
    return THEME_HEX[fg.theme];
  }
  return null;
}

export async function getScheduleData(): Promise<ScheduleData> {
  const buffer = await fetchWorkbookBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];

  const rows: unknown[][] = [];
  const fills: (string | null)[][] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const valArr: unknown[] = [];
    const fillArr: (string | null)[] = [];
    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      valArr[c - 1] = cellValue(cell);
      fillArr[c - 1] = cellFillHex(cell);
    }
    rows.push(valArr);
    fills.push(fillArr);
  }

  // global obra name -> fill color, scanning the whole sheet's site-legend column (H name, I swatch)
  const siteColors: Record<string, string> = {};
  const colorToSite: Record<string, string> = {};
  for (let r = 0; r < rows.length; r++) {
    const siteName = rows[r][7];
    const color = fills[r][8];
    if (siteName && color) {
      const name = String(siteName).trim();
      siteColors[name] = `#${color}`;
      colorToSite[color] = name;
    }
  }

  // global colaborador -> especialidad, scanning columns K (name) and L (specialty)
  const specialties: Record<string, string> = {};
  for (let r = 0; r < rows.length; r++) {
    const name = rows[r][10];
    const specialty = normalizeSpecialty(rows[r][11]);
    if (name && specialty) {
      specialties[String(name).trim().toUpperCase()] = specialty;
    }
  }

  const headerRowIdx: number[] = [];
  for (let r = 0; r < rows.length; r++) {
    const cell0 = rows[r]?.[0];
    if (typeof cell0 === "string" && parseMonths(cell0).length > 0) {
      const dayRow = rows[r + 1];
      if (dayRow && dayRow.slice(1, 6).some((v) => typeof v === "number")) {
        headerRowIdx.push(r);
      }
    }
  }

  const weeks: Week[] = [];
  let globalYear = new Date().getFullYear();
  let prevMonthGlobal: number | null = null;

  headerRowIdx.forEach((hr) => {
    const label = String(rows[hr][0]);
    const monthsForBlock = parseMonths(label);
    const dayRow = rows[hr + 1];
    const rawDays = dayRow.slice(1, 6).map((v) => (typeof v === "number" ? v : null));

    const dates: string[] = [];
    const weekdays: string[] = [];
    let monthIdx = 0;
    let prevDay: number | null = null;

    rawDays.forEach((day) => {
      if (day === null) {
        dates.push("");
        weekdays.push("");
        return;
      }
      if (prevDay !== null && day < prevDay && monthIdx < monthsForBlock.length - 1) {
        monthIdx++;
      }
      const month = monthsForBlock[monthIdx] ?? monthsForBlock[monthsForBlock.length - 1];
      if (prevMonthGlobal !== null && month < prevMonthGlobal && prevMonthGlobal - month >= 6) {
        globalYear++;
      }
      const d = new Date(Date.UTC(globalYear, month - 1, day));
      dates.push(d.toISOString().slice(0, 10));
      weekdays.push(WEEKDAY_ES[d.getUTCDay()]);
      prevDay = day;
      prevMonthGlobal = month;
    });

    const validDates = dates.filter(Boolean);
    const rangeLabel = validDates.length
      ? `${fmtDate(validDates[0])} – ${fmtDate(validDates[validDates.length - 1])}`
      : label;

    // sites in play this week: column index 7 (H), starting at the day row itself
    const sites: string[] = [];
    {
      let r = hr + 1;
      while (r < rows.length) {
        const row = rows[r];
        const site = row?.[7];
        if (site) sites.push(String(site).trim());
        r++;
        if (headerRowIdx.includes(r)) break;
        if (isBlankRow(rows[r])) break;
      }
    }

    // people rows: from hr+2 until a blank row or the next header
    const people: WeekPerson[] = [];
    for (let r = hr + 2; r < rows.length; r++) {
      if (headerRowIdx.includes(r)) break;
      const row = rows[r];
      if (isBlankRow(row)) break;
      const name = row[0];
      if (name) {
        const tasks = row.slice(1, 6).map(normalizeTask);
        const rowFills = fills[r];
        const taskSites = rowFills.slice(1, 6).map((hex) => (hex ? colorToSite[hex] ?? null : null));
        people.push({ person: String(name).trim().toUpperCase(), tasks, sites: taskSites });
      }
    }

    weeks.push({
      monthLabel: label,
      days: rawDays,
      people,
      sites,
      dates,
      weekdays,
      rangeLabel,
    });
  });

  return { weeks, siteColors, specialties };
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTH_ABBR_ES[m - 1]} ${y}`;
}
