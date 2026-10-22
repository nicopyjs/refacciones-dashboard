import type { BuildInputs, EerrData, EerrLine, PptoGasto, PptoVenta } from "./types";

/** Área del presupuesto que corresponde a este reporte (centros que parten con RCT). */
const AREA_PPTO = "Refacciones";
const PREFIJO_CN = "RCT";
const TIPOS_GASTO = new Map(["Gasto Directo", "Gasto Indirecto", "Gasto Administrativo"].map((t) => [t.toLowerCase(), t]));

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/\$/g, "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** "dd-mm-yyyy" | "yyyy-mm-dd..." | Date -> "yyyy-mm-dd" */
function isoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function build(input: BuildInputs): EerrData {
  // ---- Plan de cuentas (Table.Distinct por Code1): clasificación, mano de obra, alias 2 ----
  interface Cuenta {
    desc: string;
    cl: string;
    mo: string;
    al: string;
  }
  const plan = new Map<string, Cuenta>();
  for (const r of input.plan.slice(1)) {
    const code = text(r[0]);
    if (!code || plan.has(code)) continue;
    plan.set(code, { desc: text(r[1]), cl: text(r[4]).replace(/^null$/i, ""), mo: text(r[5]), al: text(r[6]) });
  }

  // ---- Centros de negocio (solo imputables, distinct por Code): Code -> descripción ----
  const cnByCode = new Map<string, string>();
  for (const r of input.centros.slice(1)) {
    if (text(r[4]) !== "S") continue;
    const code = text(r[2]);
    if (!code || cnByCode.has(code)) continue;
    cnByCode.set(code, text(r[3]));
  }

  // ---- Líneas contables de resultado de los centros RCT ----
  const lines: EerrLine[] = [];
  let lastDate = "";
  let sinFecha = 0;
  for (const m of input.mov) {
    const desc = cnByCode.get(text(m.bc));
    if (!desc || desc.slice(0, 3).toUpperCase() !== PREFIJO_CN) continue; // Área = Refacciones
    const acc = text(m.accountCode);
    const first = acc[0];
    if (first !== "3" && first !== "4") continue;
    const credit = num(m.credit);
    const monto = credit !== 0 ? credit : -num(m.debit);
    if (monto === 0) continue;
    const date = isoDate(m.date);
    if (!date) {
      sinFecha++;
      continue;
    }
    if (date > lastDate) lastDate = date;
    const cta = plan.get(acc);
    const esGasto = first === "4";
    // TipoGasto: la clasificación de mano de obra manda; si no, se deduce del centro de negocio.
    let tg = "";
    if (esGasto) {
      // La clasificación de mano de obra solo manda en cuentas sin clasificación de gasto; el resto se deduce del centro (igual que Power BI).
      if (cta?.mo && !cta.cl) tg = TIPOS_GASTO.get(cta.mo.toLowerCase()) ?? cta.mo; // DAX compara sin distinguir mayúsculas
      else if (desc.slice(0, 2).toUpperCase() === "GN") tg = "Gasto Administrativo";
      else if (desc.toLowerCase().includes("general")) tg = "Gasto Indirecto";
      else tg = "Gasto Directo";
    }
    lines.push({
      d: date,
      cn: desc,
      ac: acc,
      dp: cta?.desc ?? "",
      al: cta?.al ?? "",
      cl: cta?.cl ?? "",
      tg,
      t: esGasto ? "G" : "V",
      m: Math.round(monto),
      ic: `${text(m.voucherType)}-${text(m.voucherNumber)}-${text(m.comment)}`,
    });
  }
  lines.sort((a, b) => b.d.localeCompare(a.d));

  // ---- Presupuestos del área ----
  const pptoVenta: PptoVenta[] = [];
  for (const r of input.pptoGanancias.slice(1)) {
    if (text(r[3]) !== AREA_PPTO) continue;
    const d = isoDate(r[0]);
    const m = num(r[4]);
    if (d && m) pptoVenta.push({ d, m: Math.round(m) });
  }
  const pptoGasto: PptoGasto[] = [];
  for (const r of input.pptoGastos.slice(1)) {
    if (text(r[0]) !== AREA_PPTO) continue;
    const d = isoDate(r[2]);
    const m = num(r[6]);
    if (d && m) pptoGasto.push({ d, tg: text(r[1]), cl: text(r[3]), m: Math.round(m) });
  }

  return {
    generatedAt: new Date().toISOString(),
    ledgerRows: input.mov.length,
    ledgerLastDate: lastDate,
    sinFecha,
    lines,
    pptoVenta,
    pptoGasto,
  };
}
