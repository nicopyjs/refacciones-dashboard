import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import TopNav from "@/components/TopNav";
import { CATEGORIAS, getInsumosData } from "@/lib/parseInsumos";
import "../dashboard.css";
import "./insumos.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Insumos — RCT",
  description: "Pedido de materiales por especialidad",
};

export default async function InsumosPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/insumos");
  }

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

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CATEGORIAS.map((cat) => (
            <Link
              key={cat.slug}
              href={`/insumos/${cat.slug}`}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-500/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="flex flex-col gap-1">
                <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {cat.nombre}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {counts && counts[cat.slug] != null ? `${counts[cat.slug]} materiales` : "Ver lista"}
                </span>
              </span>
              <svg
                className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:text-slate-500"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 5l6 5-6 5" />
              </svg>
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
