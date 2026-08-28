import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { getInsumosData, getCategoria } from "@/lib/parseInsumos";
import InsumosPedido from "@/components/InsumosPedido";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string }>;
}): Promise<Metadata> {
  const { categoria } = await params;
  const cat = getCategoria(categoria);
  return { title: cat ? `Insumos ${cat.nombre} — RCT` : "Insumos — RCT" };
}

export default async function InsumosCategoriaPage({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
  const { categoria } = await params;
  const cat = getCategoria(categoria);
  if (!cat) notFound();

  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect(`/login?next=/insumos/${categoria}`);
  }

  try {
    const data = await getInsumosData();
    const found = data.find((c) => c.slug === categoria);
    if (!found) notFound();
    return <InsumosPedido categoria={found} generatedAt={new Date().toISOString()} error={null} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer el archivo.";
    return (
      <InsumosPedido
        categoria={{ slug: cat.slug, nombre: cat.nombre, hoja: "", items: [] }}
        generatedAt={new Date().toISOString()}
        error={message}
      />
    );
  }
}
