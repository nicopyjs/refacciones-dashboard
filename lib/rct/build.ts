import type { BuildInputs, LineRow, PptoRow, RctData } from "./types";

const SIN_CN = "(sin agrupar)";
const SIN_ALIAS = "(sin alias)";
const CUENTA_ECONOMICO = "3110101002";

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

function isErrorText(s: string): boolean {
  return s.startsWith("#N/A") || s.startsWith("#REF") || s.startsWith("#VALUE") || s.startsWith("#ERROR");
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

export function build(input: BuildInputs): RctData {
  // ---- Plan de cuentas: accountCode -> alias ----
  const aliasByAccount = new Map<string, string>();
  for (const r of input.planes.slice(1)) {
    const code = text(r[0]);
    const alias = text(r[5]);
    if (code) aliasByAccount.set(code, alias || SIN_ALIAS);
  }

  // ---- Centros de negocio: Code -> {cn agrupado, descripción} ----
  const cnByCode = new Map<string, { cn: string; desc: string }>();
  for (const r of input.idcn.slice(1)) {
    const code = text(r[2]);
    if (!code || cnByCode.has(code)) continue; // Table.Distinct por Code
    const agr = text(r[6]);
    cnByCode.set(code, { cn: agr && !isErrorText(agr) ? agr : SIN_CN, desc: text(r[3]) });
  }

  // ---- Líneas contables de resultado de RCT ----
  const lines: LineRow[] = [];
  let lastDate = "";
  for (const m of input.mov) {
    const bc = text(m.bc);
    if (!bc.startsWith("RCT")) continue;
    const acc = text(m.accountCode);
    const first = acc[0];
    if (first !== "3" && first !== "4") continue;
    const date = isoDate(m.date);
    if (!date) continue;
    if (date > lastDate) lastDate = date;
    const credit = num(m.credit);
    const monto = credit !== 0 ? credit : -num(m.debit);
    if (monto === 0) continue;
    const info = cnByCode.get(bc) ?? { cn: SIN_CN, desc: bc };
    const row: LineRow = {
      d: date,
      cn: info.cn,
      cd: info.desc,
      c1: text(m.c1),
      c2: text(m.c2),
      cm: text(m.comment),
      al: aliasByAccount.get(acc) ?? SIN_ALIAS,
      t: first === "4" ? "G" : "V",
      m: Math.round(monto),
    };
    if (acc === CUENTA_ECONOMICO) row.x = 1;
    lines.push(row);
  }
  lines.sort((a, b) => b.d.localeCompare(a.d));

  // ---- Presupuestos (hoja de costo) ----
  const pptoMap = new Map<string, PptoRow>();
  for (const r of input.pptos.slice(1)) {
    const cn = text(r[9]);
    const alias = text(r[2]);
    if (!cn) continue;
    const tipo = text(r[7]) || "CONTRATO";
    const valor = num(r[5]);
    // IMPORTE es una fórmula compartida en el Excel; se reconstruye: venta +, gasto -.
    const importe = typeof r[6] === "number" ? (r[6] as number) : alias === "VENTA" ? valor : -valor;
    const key = `${cn}|${alias}|${tipo}`;
    const cur = pptoMap.get(key);
    if (cur) cur.importe += importe;
    else pptoMap.set(key, { cn, alias, tipo, importe });
  }
  const ppto = [...pptoMap.values()].map((r) => ({ ...r, importe: Math.round(r.importe) }));

  // ---- Maestro de empleados ----
  const empleados: [string, string][] = [];
  for (const r of input.empleados.slice(1)) {
    const rut = text(r[0]);
    const nombre = text(r[1]);
    if (rut && nombre) empleados.push([rut, nombre]);
  }

  return {
    generatedAt: new Date().toISOString(),
    ledgerRows: input.mov.length,
    ledgerLastDate: lastDate,
    lines,
    ppto,
    empleados,
    cnList: [...new Set([...cnByCode.values()].map((c) => c.cn).filter((c) => c !== SIN_CN))],
  };
}
