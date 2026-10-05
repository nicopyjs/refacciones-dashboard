import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

// Pestaña oculta del menú (la ruta /gestion sigue existiendo). Poner en true para volver a mostrarla.
const MOSTRAR_GESTION = false;
// Ídem para Insumos (ruta /insumos).
const MOSTRAR_INSUMOS = false;

export default function TopNav({
  active,
}: {
  active: "calendario" | "gestion" | "observaciones" | "certificacion" | "insumos" | "facturacion" | "diagramas";
}) {
  return (
    <nav className="top-nav">
      <Link href="/" className="nav-logo" aria-label="NEB Chile, ir al calendario">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-claro" src="/logos/neb-claro.png" alt="NEB Chile" width={82} height={36} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-oscuro" src="/logos/neb-oscuro.png" alt="NEB Chile" width={82} height={36} />
      </Link>
      <Link href="/" className={active === "calendario" ? "active" : ""}>Calendario</Link>
      {MOSTRAR_GESTION && (
        <Link href="/gestion" className={active === "gestion" ? "active" : ""}>Gestión de Refacciones</Link>
      )}
      <Link href="/observaciones" className={active === "observaciones" ? "active" : ""}>Seguimiento de Tareas</Link>
      <Link href="/certificacion" className={active === "certificacion" ? "active" : ""}>Certificación</Link>
      {MOSTRAR_INSUMOS && (
        <Link href="/insumos" className={active === "insumos" ? "active" : ""}>Insumos</Link>
      )}
      <Link href="/facturacion" className={active === "facturacion" ? "active" : ""}>Tablero Facturación RCT</Link>
      <Link href="/diagramas" className={active === "diagramas" ? "active" : ""}>Diagramas</Link>
      <ThemeToggle />
    </nav>
  );
}
