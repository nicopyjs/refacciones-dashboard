import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function TopNav({
  active,
}: {
  active: "calendario" | "gestion" | "observaciones" | "certificacion" | "insumos" | "facturacion" | "diagramas";
}) {
  return (
    <nav className="top-nav">
      <Link href="/" className={active === "calendario" ? "active" : ""}>Calendario</Link>
      <Link href="/gestion" className={active === "gestion" ? "active" : ""}>Gestión de Refacciones</Link>
      <Link href="/observaciones" className={active === "observaciones" ? "active" : ""}>Seguimiento de Observaciones</Link>
      <Link href="/certificacion" className={active === "certificacion" ? "active" : ""}>Certificación</Link>
      <Link href="/insumos" className={active === "insumos" ? "active" : ""}>Insumos</Link>
      <Link href="/facturacion" className={active === "facturacion" ? "active" : ""}>Tablero Facturación RCT</Link>
      <Link href="/diagramas" className={active === "diagramas" ? "active" : ""}>Diagramas</Link>
      <ThemeToggle />
    </nav>
  );
}
