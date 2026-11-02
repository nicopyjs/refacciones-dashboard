import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { formatear, getUltimo, numeroDe, registrar } from "@/lib/correlativo";

export const dynamic = "force-dynamic";

async function autorizado(): Promise<boolean> {
  return isValidSessionValue((await cookies()).get(SESSION_COOKIE)?.value);
}

const respuesta = (ultimo: number) => NextResponse.json({ ultimo, siguiente: formatear(ultimo + 1) });

/** Próximo código de presupuesto disponible. */
export async function GET() {
  if (!(await autorizado())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    return respuesta(await getUltimo());
  } catch {
    return NextResponse.json({ error: "No se pudo leer el correlativo." }, { status: 500 });
  }
}

/** Registra un código emitido para que el siguiente sea el número que sigue. */
export async function POST(req: NextRequest) {
  if (!(await autorizado())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const n = typeof body?.codigo === "string" ? numeroDe(body.codigo) : null;
  try {
    // Un código que no sigue el formato (por ejemplo uno escrito a mano) simplemente no mueve el contador.
    return respuesta(n != null ? await registrar(n) : await getUltimo());
  } catch {
    return NextResponse.json({ error: "No se pudo registrar el correlativo." }, { status: 500 });
  }
}
