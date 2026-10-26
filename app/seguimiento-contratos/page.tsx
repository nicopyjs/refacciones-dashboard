import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { getSeguimientoData } from "@/lib/seguimiento/data";
import SeguimientoContratosDashboard from "@/components/SeguimientoContratosDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Seguimiento de Contratos",
  description: "Avance del proceso de contratos por edificio: etapa actual, área responsable, días en la etapa y estado",
};

export default async function SeguimientoContratosPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/seguimiento-contratos");
  }

  try {
    const data = await getSeguimientoData();
    return <SeguimientoContratosDashboard data={data} generatedAt={data.generatedAt} error={null} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer el Excel.";
    return <SeguimientoContratosDashboard data={null} generatedAt={new Date().toISOString()} error={message} />;
  }
}
