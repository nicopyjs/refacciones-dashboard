import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calendario de Refacciones — RCT Operativo",
  description: "Asignación diaria de tareas por colaborador y obras en curso",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
