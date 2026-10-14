import { gunzipSync, gzipSync } from "node:zlib";
import { Redis } from "@upstash/redis";
import { build } from "./build";
import { loadAllInputs } from "./sources";
import type { RctData } from "./types";

const PREFIX = "rct:data:v1";
const LOCK_KEY = `${PREFIX}:lock`;
const CHUNK = 350_000; // caracteres base64 por clave (límite de request de Upstash)
/** Cuánto tiempo se considera fresco el cache antes de recalcular en segundo plano. */
export const FRESH_MS = 30 * 60 * 1000;

function getRedis(): Redis {
  return new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
}

async function readCache(): Promise<RctData | null> {
  const redis = getRedis();
  const meta = await redis.get<{ chunks: number }>(`${PREFIX}:meta`);
  if (!meta || !meta.chunks) return null;
  const parts = await Promise.all(Array.from({ length: meta.chunks }, (_, i) => redis.get<string>(`${PREFIX}:${i}`)));
  if (parts.some((p) => typeof p !== "string")) return null;
  const json = gunzipSync(Buffer.from((parts as string[]).join(""), "base64")).toString("utf8");
  return JSON.parse(json) as RctData;
}

async function writeCache(data: RctData): Promise<void> {
  const redis = getRedis();
  const b64 = gzipSync(Buffer.from(JSON.stringify(data))).toString("base64");
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += CHUNK) chunks.push(b64.slice(i, i + CHUNK));
  await Promise.all(chunks.map((c, i) => redis.set(`${PREFIX}:${i}`, c)));
  await redis.set(`${PREFIX}:meta`, { chunks: chunks.length, generatedAt: data.generatedAt });
}

/** Lee todas las fuentes de Google y recalcula los agregados (sin tocar el cache). */
export async function computeRctData(): Promise<RctData> {
  return build(await loadAllInputs());
}

/** Recalcula y guarda en Redis. Un lock corto evita recálculos concurrentes. */
export async function refreshRctData(): Promise<RctData | null> {
  const redis = getRedis();
  const got = await redis.set(LOCK_KEY, "1", { nx: true, ex: 180 });
  if (!got) return null;
  try {
    const data = await computeRctData();
    await writeCache(data);
    return data;
  } finally {
    await redis.del(LOCK_KEY);
  }
}

export interface RctLoad {
  data: RctData;
  stale: boolean;
}

/**
 * Devuelve los datos desde Redis. Si no hay cache, calcula en el momento.
 * Si el cache está vencido, `stale` es true y el llamador puede refrescar en segundo plano.
 */
export async function getRctData(opts: { force?: boolean } = {}): Promise<RctLoad> {
  if (!opts.force) {
    try {
      const cached = await readCache();
      if (cached) return { data: cached, stale: Date.now() - Date.parse(cached.generatedAt) > FRESH_MS };
    } catch {
      // Redis no disponible: se calcula directo.
    }
  }
  const data = await computeRctData();
  try {
    await writeCache(data);
  } catch {
    // sin cache, igual se muestran los datos
  }
  return { data, stale: false };
}
