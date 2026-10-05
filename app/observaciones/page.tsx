import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { getObservaciones } from "@/lib/parseObservaciones";
import ObservacionesDashboard from "@/components/ObservacionesDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Seguimiento de Tareas — RCT",
  description: "Observaciones de ITO, post-entrega y certificación por obra",
};

export default async function ObservacionesPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/observaciones");
  }

  try {
    const observaciones = await getObservaciones();
    return <ObservacionesDashboard observaciones={observaciones} generatedAt={new Date().toISOString()} error={null} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer el archivo.";
    return <ObservacionesDashboard observaciones={[]} generatedAt={new Date().toISOString()} error={message} />;
  }
}
