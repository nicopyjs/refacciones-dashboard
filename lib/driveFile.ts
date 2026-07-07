import ExcelJS from "exceljs";

export async function fetchWorkbookBuffer(fileId: string): Promise<ArrayBuffer> {
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(url, { cache: "no-store" });
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

export async function loadWorkbook(fileId: string): Promise<ExcelJS.Workbook> {
  const buffer = await fetchWorkbookBuffer(fileId);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

export function cellValue(cell: ExcelJS.Cell): unknown {
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

// Raw XML theme-color order as Excel indexes it for cell fills
// (background/text slots 0-3 swapped vs. clrScheme document order).
const THEME_HEX = [
  "FFFFFF", "000000", "E7E6E6", "44546A",
  "4472C4", "ED7D31", "A5A5A5", "FFC000",
  "5B9BD5", "70AD47", "0563C1", "954F72",
];

export function cellFillHex(cell: ExcelJS.Cell): string | null {
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

export function rowsWithFills(sheet: ExcelJS.Worksheet, maxCol: number): { rows: unknown[][]; fills: (string | null)[][] } {
  const rows: unknown[][] = [];
  const fills: (string | null)[][] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const valArr: unknown[] = [];
    const fillArr: (string | null)[] = [];
    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c);
      valArr[c - 1] = cellValue(cell);
      fillArr[c - 1] = cellFillHex(cell);
    }
    rows.push(valArr);
    fills.push(fillArr);
  }
  return { rows, fills };
}
