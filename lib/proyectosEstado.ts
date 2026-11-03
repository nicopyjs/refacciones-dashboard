import { Redis } from "@upstash/redis";
import { type EtapaKey, type ProyectoEstado } from "./proyectosEstadoTypes";

const HASH_KEY = "diagramas:proyectos";

const getRedis = () => new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });

export async function listarProyectos(): Promise<ProyectoEstado[]> {
  const raw = await getRedis().hgetall<Record<string, ProyectoEstado>>(HASH_KEY);
  return Object.values(raw ?? {}).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Crea el proyecto (si no hay id) o actualiza su etapa/paso. El nombre se conserva al actualizar. */
export async function guardarProyecto(input: { id?: string; nombre?: string; etapa: EtapaKey; paso: number | null }): Promise<ProyectoEstado> {
  const redis = getRedis();
  const previo = input.id ? await redis.hget<ProyectoEstado>(HASH_KEY, input.id) : null;
  const nombre = (previo?.nombre ?? input.nombre ?? "").trim().slice(0, 80);
  if (!nombre) throw new Error("Falta el nombre del proyecto.");
  const p: ProyectoEstado = {
    id: previo?.id ?? crypto.randomUUID(),
    nombre,
    etapa: input.etapa,
    paso: input.paso,
    actualizado: new Date().toISOString(),
  };
  await redis.hset(HASH_KEY, { [p.id]: p });
  return p;
}

export async function eliminarProyecto(id: string): Promise<void> {
  await getRedis().hdel(HASH_KEY, id);
}
