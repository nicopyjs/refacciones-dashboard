import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { after } from "next/server";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { getRctData, refreshRctData } from "@/lib/rct/data";
import RctDashboard from "@/components/RctDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Venta y Gastos RCT",
  description: "Venta, gasto y presupuesto de Refacciones e Instalaciones, réplica del tablero de Power BI",
};

export default async function RctPage({ searchParams }: { searchParams: Promise<{ refresh?: string }> }) {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/rct");
  }

  let forced = false;
  const forzar = (await searchParams).refresh !== undefined;
  try {
    const { data, stale } = await getRctData({ force: forzar });
    // Cache vencido: se muestra lo guardado y se recalcula en segundo plano.
    if (stale) after(() => refreshRctData().then(() => undefined).catch(() => undefined));
    if (!forzar) return <RctDashboard data={data} generatedAt={data.generatedAt} stale={stale} error={null} />;
    forced = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer las fuentes.";
    return <RctDashboard data={null} generatedAt={new Date().toISOString()} stale={false} error={message} />;
  }
  if (forced) redirect("/rct");
}
