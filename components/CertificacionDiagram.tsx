"use client";

import DiagramaZoom, { type LegendItem } from "./DiagramaZoom";
import { CERTIFICACION_HTML } from "@/lib/diagramaCertificacionHtml";

const LEGEND: LegendItem[] = [
  { label: "Certificadores", bg: "#7B5EA7" },
  { label: "NEB · Refacción", bg: "#1F6F8B" },
  { label: "NEB · Instalación", bg: "#3E5C8A" },
  { label: "SEREMI", bg: "#D9822B" },
  { label: "Hito de facturación", bg: "#2E9E6A" },
  { label: "Revisión / observaciones", line: "#D2463C" },
  { label: "Requisito / documento", line: "#7B5EA7" },
];

export default function CertificacionDiagram() {
  return <DiagramaZoom html={CERTIFICACION_HTML} legend={LEGEND} initialZoom={0} crop={{ x0: 40, y0: 232, w: 3232, h: 2240, canvasW: 3312, canvasH: 2520 }} />;
}
