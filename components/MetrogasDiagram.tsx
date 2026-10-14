"use client";

import DiagramaZoom, { type LegendItem } from "./DiagramaZoom";
import { METROGAS_HTML } from "@/lib/diagramaMetrogasHtml";

const LEGEND: LegendItem[] = [
  { label: "NEB Chile (empresa)", bg: "#1F6F8B" },
  { label: "Comunidad", bg: "#7B5EA7" },
  { label: "Gestor Metrogas", bg: "#D9822B" },
  { label: "Legal Metrogas", bg: "#B0623A" },
  { label: "Comercial / financiero Metrogas", bg: "#8A6D1F" },
  { label: "Firmantes Metrogas", bg: "#2E6E5E" },
  { label: "Devolución para regularizar", line: "#C8423A" },
  { label: "Aprobado", line: "#23895B" },
];

export default function MetrogasDiagram() {
  return <DiagramaZoom html={METROGAS_HTML} legend={LEGEND} initialZoom={2} crop={{ x0: 0, y0: 0, w: 3600, h: 912, canvasW: 3600, canvasH: 912 }} />;
}
