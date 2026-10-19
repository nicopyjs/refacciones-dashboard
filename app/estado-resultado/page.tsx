import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { after } from "next/server";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { getEerrData, refreshEerrData } from "@/lib/eerr/data";
import EerrDashboard from "@/components/EerrDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Estado de Resultado RCT",
  description: "Ingresos, egresos y estado de resultados de Refacciones (RCT), réplica del reporte de Power BI",
};

export default async function EstadoResultadoPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/estado-resultado");
  }

  try {
    const { data, stale } = await getEerrData();
    // Cache vencido: se muestra lo guardado y se recalcula en segundo plano.
    if (stale) after(() => refreshEerrData().then(() => undefined).catch(() => undefined));
    return <EerrDashboard data={data} generatedAt={data.generatedAt} stale={stale} error={null} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer las fuentes.";
    return <EerrDashboard data={null} generatedAt={new Date().toISOString()} stale={false} error={message} />;
  }
}
