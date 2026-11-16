import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { getIngenieriaEntregaData } from "@/lib/parseIngenieriaEntrega";
import IngenieriaEntregaDashboard from "@/components/IngenieriaEntregaDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Ingeniería y Entrega — RCT",
  description: "Seguimiento de ingeniería y de entrega / puesta en régimen por obra",
};

export default async function IngenieriaEntregaPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/ingenieria-entrega");
  }

  try {
    const { ingenieria, entrega } = await getIngenieriaEntregaData();
    return <IngenieriaEntregaDashboard ingenieria={ingenieria} entrega={entrega} generatedAt={new Date().toISOString()} error={null} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer el archivo.";
    return <IngenieriaEntregaDashboard ingenieria={null} entrega={null} generatedAt={new Date().toISOString()} error={message} />;
  }
}
