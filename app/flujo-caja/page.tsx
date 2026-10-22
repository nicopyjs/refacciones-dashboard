import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { getFlujoData } from "@/lib/flujo/data";
import FlujoCajaDashboard from "@/components/FlujoCajaDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Flujo de Caja Consolidado",
  description: "Flujo de caja y rentabilidad consolidados del área Refacción, con y sin cuotas con provisionamiento",
};

export default async function FlujoCajaPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/flujo-caja");
  }

  try {
    const data = await getFlujoData();
    return <FlujoCajaDashboard data={data} generatedAt={data.generatedAt} error={null} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer el Excel.";
    return <FlujoCajaDashboard data={null} generatedAt={new Date().toISOString()} error={message} />;
  }
}
