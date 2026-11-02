import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import CalculadoraPresupuestosDashboard from "@/components/CalculadoraPresupuestosDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calculadora de Presupuestos",
  description: "Calculadora de presupuestos RCT: materiales, mano de obra, márgenes, IVA y utilidad",
};

export default async function CalculadoraPresupuestosPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/calculadora-presupuestos");
  }
  return <CalculadoraPresupuestosDashboard />;
}
