import Link from "next/link";

export default function TopNav({ active }: { active: "calendario" | "gestion" }) {
  return (
    <nav className="top-nav">
      <Link href="/" className={active === "calendario" ? "active" : ""}>Calendario</Link>
      <Link href="/gestion" className={active === "gestion" ? "active" : ""}>Gestión de Refacciones</Link>
    </nav>
  );
}
