import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { getRefaccionesData } from "@/lib/parseRefacciones";
import GestionDashboard from "@/components/GestionDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Gestión de Refacciones — RCT",
  description: "Estado de entrega, garantías y especificaciones técnicas por obra",
};

export default async function GestionPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/gestion");
  }

  try {
    const { obras, especificaciones } = await getRefaccionesData();
    return (
      <GestionDashboard
        obras={obras}
        especificaciones={especificaciones}
        generatedAt={new Date().toISOString()}
        error={null}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer el archivo.";
    return <GestionDashboard obras={[]} especificaciones={[]} generatedAt={new Date().toISOString()} error={message} />;
  }
}
