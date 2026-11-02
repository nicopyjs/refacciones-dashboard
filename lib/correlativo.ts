import { Redis } from "@upstash/redis";

/** Correlativo de presupuestos: PSCA-01, PSCA-02, ... */
export const PREFIJO_PRESUPUESTO = "PSCA-";
const ANCHO = 2;
const KEY = "presupuestos:ultimo";
/** Último número ya emitido cuando se creó el contador (PSCA-01 Amunátegui 725). */
const ULTIMO_INICIAL = 1;

const getRedis = () => new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });

export const formatear = (n: number) => `${PREFIJO_PRESUPUESTO}${String(n).padStart(ANCHO, "0")}`;

/** Número de un código con nuestro prefijo ("PSCA-07" → 7); null si no corresponde. */
export function numeroDe(codigo: string): number | null {
  const m = new RegExp(`^${PREFIJO_PRESUPUESTO}(\\d+)$`, "i").exec(codigo.trim());
  return m ? parseInt(m[1], 10) : null;
}

export async function getUltimo(): Promise<number> {
  const v = await getRedis().get<number>(KEY);
  return typeof v === "number" && Number.isFinite(v) ? v : ULTIMO_INICIAL;
}

/** Marca un número como emitido; el contador solo sube, nunca baja. */
export async function registrar(n: number): Promise<number> {
  const redis = getRedis();
  const actual = await getUltimo();
  if (n > actual) {
    await redis.set(KEY, n);
    return n;
  }
  return actual;
}
