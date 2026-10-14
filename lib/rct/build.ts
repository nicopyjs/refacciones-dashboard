import type {
  AdicionalRow,
  AreaRct,
  BuildInputs,
  DetalleRow,
  GlRow,
  ObraSupervisorRow,
  PptoGastoRow,
  PptoRow,
  RctData,
} from "./types";

const SIN_CN = "(sin agrupar)";
const SIN_ALIAS = "(sin alias)";
export const CN_INDIRECTOS = "RCTA - GENERAL REFACCION CENTRALES TERMICAS";

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/\$/g, "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Número con coma decimal ("106,47") o punto ("60.78"). */
function numFlexible(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string") return 0;
  const s = v.replace(/[$\s]/g, "");
  if (!s) return 0;
  const n = s.includes(",") && !s.includes(".") ? parseFloat(s.replace(",", ".")) : parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function isErrorText(s: string): boolean {
  return s.startsWith("#N/A") || s.startsWith("#REF") || s.startsWith("#VALUE") || s.startsWith("#ERROR");
}

/** "dd-mm-yyyy" | "yyyy-mm-dd..." | Date ISO -> "yyyy-mm-dd" */
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

  // ---- Libro mayor agregado ----
  const glMap = new Map<string, GlRow>();
  const detalle: DetalleRow[] = [];
  let lastDate = "";
  for (const m of input.mov) {
    const bc = text(m.bc);
    let area: AreaRct;
    if (bc.startsWith("RCT")) area = "RCT";
    else if (bc.startsWith("INT")) area = "INTA";
    else continue;
    const acc = text(m.accountCode);
    const first = acc[0];
    if (first !== "3" && first !== "4") continue;
    const tipo = first === "4" ? "Gasto" : "Ganancia";
    const date = isoDate(m.date);
    if (!date) continue;
    if (date > lastDate) lastDate = date;
    const credit = num(m.credit);
    const monto = credit !== 0 ? credit : -num(m.debit);
    const cnInfo = cnByCode.get(bc) ?? { cn: SIN_CN, desc: bc };
    const alias = aliasByAccount.get(acc) ?? SIN_ALIAS;
    const ym = date.slice(0, 7);
    const key = `${ym}|${area}|${cnInfo.cn}|${alias}|${tipo}`;
    const cur = glMap.get(key);
    if (cur) cur.monto += monto;
    else glMap.set(key, { ym, area, cn: cnInfo.cn, alias, tipo, monto });

    if (area === "RCT" && tipo === "Gasto" && cnInfo.cn === CN_INDIRECTOS) {
      detalle.push({
        date,
        c1: text(m.c1),
        c2: text(m.c2),
        comment: text(m.comment),
        alias,
        cnDesc: cnInfo.desc,
        cn: cnInfo.cn,
        monto,
      });
    }
  }
  const gl = [...glMap.values()]
    .map((r) => ({ ...r, monto: Math.round(r.monto) }))
    .filter((r) => r.monto !== 0)
    .sort((a, b) => a.ym.localeCompare(b.ym));
  detalle.sort((a, b) => b.date.localeCompare(a.date));

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

  // ---- Presupuesto de gastos mensual por área ----
  const pgMap = new Map<string, PptoGastoRow>();
  for (const r of input.pptoGastos.slice(1)) {
    const area = text(r[0]);
    const date = isoDate(r[2]);
    if (!area || !date) continue;
    const ym = date.slice(0, 7);
    const key = `${ym}|${area}`;
    const cur = pgMap.get(key);
    const monto = num(r[6]);
    if (cur) cur.monto += monto;
    else pgMap.set(key, { ym, area, monto });
  }
  const pptoGastos = [...pgMap.values()].map((r) => ({ ...r, monto: Math.round(r.monto) }));

  // ---- Adicionales de obra ----
  const adicionales: AdicionalRow[] = [];
  for (const r of input.adicionales.slice(1)) {
    const obra = text(r[0]);
    if (!obra) continue;
    adicionales.push({
      obra,
      tipo: text(r[1]),
      codigo: text(r[2]),
      asunto: text(r[3]),
      valorUf: numFlexible(r[4]),
      estado: text(r[5]).toUpperCase(),
      fechaApr: isoDate(r[7]),
      fac: text(r[8]).toUpperCase(),
      fechaFac: isoDate(r[9]),
      montoClp: Math.round(numFlexible(r[10])),
    });
  }

  // ---- Obra / supervisor ----
  const obraSupervisor: ObraSupervisorRow[] = [];
  for (const r of input.obraSupervisor.slice(1)) {
    const obra = text(r[0]);
    if (obra) obraSupervisor.push({ obra, supervisor: text(r[1]) });
  }

  return {
    generatedAt: new Date().toISOString(),
    ledgerRows: input.mov.length,
    ledgerLastDate: lastDate,
    gl,
    detalleIndirectos: detalle,
    ppto,
    pptoGastos,
    adicionales,
    obraSupervisor,
    cnList: [...new Set([...cnByCode.values()].map((c) => c.cn).filter((c) => c !== SIN_CN))],
  };
}
