// Datos del pipeline RETROFIT (id 3) de Pipedrive.
// Cada año se crean etapas nuevas "Adjudicada YYYY" / "Perdido YYYY": agregar aquí los ids
// apenas existan, para que los negocios del año nuevo no queden fuera del dashboard.

export const PIPELINE_ID = 3;
// El año de cierre es el de la ETAPA (columna de Pipedrive), no el de la fecha del negocio.
export const STAGE_ADJ_YEAR: Record<number, string> = { 18: "2023", 29: "2024", 78: "2025", 84: "2026" }; // Adjudicada YYYY
export const STAGE_PERD_YEAR: Record<number, string> = { 19: "2023", 37: "2024", 82: "2025", 85: "2026" }; // PERDIDO (≤2023) / Perdidos 2024 / Perdido 2025 / Perdido 2026
export const STAGE_ADJ_IDS = Object.keys(STAGE_ADJ_YEAR).map(Number);
export const STAGE_PERD_IDS = Object.keys(STAGE_PERD_YEAR).map(Number);
export const STAGE_ENV = 14; // Enviada
export const STAGE_EARLY: { id: number; label: string }[] = [
  { id: 12, label: "Prospección" },
  { id: 13, label: "Visitar" },
  { id: 15, label: "Negociación" },
];

// Campos personalizados (fechas rellenadas a mano). Si faltan, se usa stage_change_time.
const F_FECHA_ADJ = "f5bc19dd75450682394fb14761fefcbd82a0d2ce";
const F_FECHA_ENVIO = "7bd6a433ad5e8267a7fbdf84c8ddccdb56c8a98f";
const F_FECHA_CARTA = "620bf0aa39168841a785da61fbdd4c24213c516a";
const F_FECHA_REUNION = "0c6bd926d60acfe5d533d6a2c31718e2a3f9675b";
const F_CAUSA_RECHAZO = "255cbc1b027056f138cd39eadf6621a94777075b";

const UF_FALLBACK = 39000;

export type Estado = "adj" | "perd" | "env" | "early";

export interface RetrofitDeal {
  id: number;
  title: string;
  cliente: string;
  owner: string;
  estado: Estado;
  stageId: number;
  /** Estado en Pipedrive: open / won / lost. El tablero de Pipedrive solo muestra los open. */
  status: string;
  currency: string;
  rawValue: number;
  /** Valor en CLP (UF convertida). */
  clp: number;
  /** Año de la etapa (Adjudicada/Perdido YYYY); null si no es una etapa de cierre. */
  anio: string | null;
  /** Fecha (YYYY-MM-DD) que ubica el negocio en el tiempo. */
  fecha: string | null;
  fechaEnvio: string | null;
  /** Fecha (YYYY-MM-DD) de la carta oferta, si existe. */
  fechaCarta: string | null;
  tieneCarta: boolean;
  tieneReunion: boolean;
  causa: string | null;
  url: string;
}

export interface RetrofitData {
  deals: RetrofitDeal[];
  ufRate: number;
  generatedAt: string;
}

interface RawDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  stage_id: number;
  pipeline_id: number;
  status: string;
  owner_name?: string | null;
  org_name?: string | null;
  org_id?: { name?: string } | number | null;
  stage_change_time: string | null;
  lost_reason?: string | null;
  [key: string]: unknown;
}

function baseUrl() {
  return `https://${process.env.PIPEDRIVE_DOMAIN || "nebchile"}.pipedrive.com`;
}

async function fetchAllRaw(): Promise<RawDeal[]> {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!token) throw new Error("Falta la variable de entorno PIPEDRIVE_API_TOKEN.");
  const out: RawDeal[] = [];
  let start = 0;
  for (let guard = 0; guard < 40; guard++) {
    const url = `${baseUrl()}/v1/deals?api_token=${token}&start=${start}&limit=500&pipeline_id=${PIPELINE_ID}&status=all_not_deleted`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Pipedrive respondió HTTP ${res.status}.`);
    const json = (await res.json()) as {
      success: boolean;
      error?: string;
      data: RawDeal[] | null;
      additional_data?: { pagination?: { more_items_in_collection?: boolean; next_start?: number } };
    };
    if (!json.success) throw new Error(json.error || "Error de la API de Pipedrive.");
    out.push(...(json.data ?? []));
    const pg = json.additional_data?.pagination;
    if (!pg?.more_items_in_collection) break;
    start = pg.next_start ?? start + 500;
  }
  return out;
}

async function fetchUf(): Promise<number> {
  try {
    const res = await fetch("https://mindicador.cl/api/uf", { next: { revalidate: 3600 } });
    const json = (await res.json()) as { serie?: { valor: number }[] };
    const v = json.serie?.[0]?.valor;
    return typeof v === "number" && v > 1000 ? v : UF_FALLBACK;
  } catch {
    return UF_FALLBACK;
  }
}

const day = (v: unknown): string | null => (typeof v === "string" && v ? v.slice(0, 10) : null);

export async function getRetrofitData(): Promise<RetrofitData> {
  const [raw, ufRate] = await Promise.all([fetchAllRaw(), fetchUf()]);
  const early = new Set(STAGE_EARLY.map((s) => s.id));
  const deals: RetrofitDeal[] = [];

  for (const r of raw) {
    const stageId = Number(r.stage_id);
    let estado: Estado;
    if (STAGE_ADJ_IDS.includes(stageId)) estado = "adj";
    else if (STAGE_PERD_IDS.includes(stageId)) estado = "perd";
    else if (stageId === STAGE_ENV) estado = "env";
    else if (early.has(stageId) && r.status === "open") estado = "early";
    else continue;

    const rawValue = Number(r.value) || 0;
    const currency = r.currency || "CLP";
    const fechaEnvio = day(r[F_FECHA_ENVIO]);
    const fechaCarta = day(r[F_FECHA_CARTA]);
    const fecha =
      estado === "adj"
        ? day(r[F_FECHA_ADJ]) ?? day(r.stage_change_time)
        : estado === "env"
          ? fechaEnvio ?? day(r.stage_change_time)
          : day(r.stage_change_time);
    const causaCampo = typeof r[F_CAUSA_RECHAZO] === "string" ? (r[F_CAUSA_RECHAZO] as string).trim() : "";
    const causa = causaCampo || (typeof r.lost_reason === "string" ? r.lost_reason.trim() : "");
    const org = typeof r.org_id === "object" && r.org_id ? r.org_id.name : r.org_name;

    deals.push({
      id: r.id,
      title: r.title,
      cliente: org || "Sin cliente",
      owner: r.owner_name || "Sin ejecutivo",
      estado,
      stageId,
      status: r.status,
      anio: estado === "adj" ? STAGE_ADJ_YEAR[stageId] : estado === "perd" ? STAGE_PERD_YEAR[stageId] : null,
      currency,
      rawValue,
      clp: currency === "CLF" ? rawValue * ufRate : rawValue,
      fecha,
      fechaEnvio,
      fechaCarta,
      tieneCarta: Boolean(fechaCarta),
      tieneReunion: Boolean(day(r[F_FECHA_REUNION])),
      causa: causa ? causa.charAt(0).toUpperCase() + causa.slice(1).toLowerCase() : null,
      url: `${baseUrl()}/deal/${r.id}`,
    });
  }

  return { deals, ufRate, generatedAt: new Date().toISOString() };
}
