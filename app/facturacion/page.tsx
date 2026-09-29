import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { getFacturacionData } from "@/lib/parseFacturacion";
import FacturacionDashboard from "@/components/FacturacionDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Tablero Facturación RCT",
  description: "Facturación mensual de refacciones por estado: facturado, esperando códigos y proyección",
};

export default async function FacturacionPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/facturacion");
  }

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  try {
    const data = await getFacturacionData();
    return <FacturacionDashboard data={data} todayKey={todayKey} generatedAt={now.toISOString()} error={null} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer el archivo.";
    return <FacturacionDashboard data={null} todayKey={todayKey} generatedAt={now.toISOString()} error={message} />;
  }
}
