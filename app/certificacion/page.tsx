import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { getCertificacionData } from "@/lib/parseCertificacion";
import CertificacionDashboard from "@/components/CertificacionDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Certificación de Refacciones — RCT",
  description: "Seguimiento de certificación SEC/SEREMI y rechazos por obra",
};

export default async function CertificacionPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/certificacion");
  }

  try {
    const { proyectos, rechazos } = await getCertificacionData();
    return (
      <CertificacionDashboard
        proyectos={proyectos}
        rechazos={rechazos}
        generatedAt={new Date().toISOString()}
        error={null}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer el archivo.";
    return <CertificacionDashboard proyectos={[]} rechazos={[]} generatedAt={new Date().toISOString()} error={message} />;
  }
}
