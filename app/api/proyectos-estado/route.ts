import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { eliminarProyecto, guardarProyecto, listarProyectos } from "@/lib/proyectosEstado";
import { esEtapa } from "@/lib/proyectosEstadoTypes";
import { getSeguimientoData } from "@/lib/seguimiento/data";

export const dynamic = "force-dynamic";

async function autorizado(): Promise<boolean> {
  return isValidSessionValue((await cookies()).get(SESSION_COOKIE)?.value);
}
const noAuth = () => NextResponse.json({ error: "No autorizado." }, { status: 401 });

/** Proyectos con su estado, más los edificios del Seguimiento de Contratos como sugerencias de nombre. */
export async function GET() {
  if (!(await autorizado())) return noAuth();
  try {
    const proyectos = await listarProyectos();
    const sugerencias = await getSeguimientoData()
      .then((d) => d.edificios.map((e) => e.edificio).filter(Boolean))
      .catch(() => [] as string[]);
    return NextResponse.json({ proyectos, sugerencias });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer los proyectos." }, { status: 500 });
  }
}

/** Crea un proyecto ({nombre, etapa, paso}) o cambia su estado ({id, etapa, paso}). */
export async function POST(req: NextRequest) {
  if (!(await autorizado())) return noAuth();
  const b = await req.json().catch(() => null);
  if (!b || !esEtapa(b.etapa)) return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
  const paso = Number.isInteger(b.paso) && b.paso > 0 && b.paso < 100 ? (b.paso as number) : null;
  try {
    const proyecto = await guardarProyecto({
      id: typeof b.id === "string" ? b.id : undefined,
      nombre: typeof b.nombre === "string" ? b.nombre : undefined,
      etapa: b.etapa,
      paso,
    });
    return NextResponse.json({ proyecto });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await autorizado())) return noAuth();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  try {
    await eliminarProyecto(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar." }, { status: 500 });
  }
}
