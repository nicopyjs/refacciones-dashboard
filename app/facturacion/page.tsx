import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { FACTURACION_FILE_ID, parseFacturacionSheet } from "@/lib/parseFacturacion";
import { parseCostoRealSheet, type CostoRealData } from "@/lib/parseCostoReal";
import { loadWorkbook } from "@/lib/driveFile";
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
    const wb = await loadWorkbook(FACTURACION_FILE_ID);
    const data = parseFacturacionSheet(wb);
    let costo: CostoRealData | null = null;
    let costoError: string | null = null;
    try {
      costo = parseCostoRealSheet(wb);
    } catch (err) {
      costoError = err instanceof Error ? err.message : "Error desconocido al leer Costo real.";
    }
    return <FacturacionDashboard data={data} costo={costo} costoError={costoError} todayKey={todayKey} generatedAt={now.toISOString()} error={null} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer el archivo.";
    return <FacturacionDashboard data={null} costo={null} costoError={null} todayKey={todayKey} generatedAt={now.toISOString()} error={message} />;
  }
}
