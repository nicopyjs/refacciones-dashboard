import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import DiagramasDashboard from "@/components/DiagramasDashboard";

export const metadata: Metadata = {
  title: "Diagramas del área de Refacciones",
  description: "Flujo general del área y detalle de la entrega y puesta en régimen",
};

export default async function DiagramasPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/diagramas");
  }
  return <DiagramasDashboard />;
}
