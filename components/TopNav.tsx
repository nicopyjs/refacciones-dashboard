import Link from "next/link";

export default function TopNav({ active }: { active: "calendario" | "gestion" | "observaciones" | "certificacion" }) {
  return (
    <nav className="top-nav">
      <Link href="/" className={active === "calendario" ? "active" : ""}>Calendario</Link>
      <Link href="/gestion" className={active === "gestion" ? "active" : ""}>Gestión de Refacciones</Link>
      <Link href="/observaciones" className={active === "observaciones" ? "active" : ""}>Seguimiento de Observaciones</Link>
      <Link href="/certificacion" className={active === "certificacion" ? "active" : ""}>Certificación</Link>
    </nav>
  );
}
