import Link from "next/link";
import type { Metadata } from "next";
import TopNav from "@/components/TopNav";
import { CATEGORIAS, getInsumosData } from "@/lib/parseInsumos";
import "../dashboard.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Insumos — RCT",
  description: "Pedido de materiales por especialidad",
};

export default async function InsumosPage() {
  let counts: Record<string, number> | null = null;
  try {
    const data = await getInsumosData();
    counts = Object.fromEntries(data.map((c) => [c.slug, c.items.length]));
  } catch {
    counts = null;
  }

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="insumos" />
        <header className="page-head">
          <h1>Pedido de Insumos</h1>
          <p className="sub">
            Elige tu especialidad, ingresa las cantidades que necesitas y descarga el PDF o envía el
            pedido por correo a Adquisiciones.
          </p>
        </header>

        <div className="insumo-cards">
          {CATEGORIAS.map((cat) => (
            <Link key={cat.slug} href={`/insumos/${cat.slug}`} className="insumo-card">
              <span className="insumo-card-title">{cat.nombre}</span>
              <span className="insumo-card-count">
                {counts && counts[cat.slug] != null ? `${counts[cat.slug]} materiales` : "Ver lista"}
              </span>
            </Link>
          ))}
        </div>

        <footer className="note">
          <strong>Sobre esta página:</strong> la lista de materiales y especificaciones se lee
          directamente desde el archivo en Google Drive cada vez que alguien la visita. Las cantidades
          que ingresas no se guardan: solo se usan para el PDF y el correo.
        </footer>
      </div>
    </div>
  );
}
