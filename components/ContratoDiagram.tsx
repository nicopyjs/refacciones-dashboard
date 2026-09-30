"use client";

import DiagramaZoom, { type LegendItem } from "./DiagramaZoom";
import { CONTRATO_HTML } from "@/lib/diagramaContratoHtml";

const LEGEND: LegendItem[] = [
  { label: "Metrogas", bg: "#D9822B" },
  { label: "NEB · Refacción", bg: "#1F6F8B" },
  { label: "NEB · Servicio Técnico", bg: "#4A90B8" },
  { label: "NEB · TyP", bg: "#7FB8CF" },
  { label: "Cliente", bg: "#7B5EA7" },
  { label: "Contrato firmado", bg: "#2E9E6A" },
  { label: "Rechazo / revisión", line: "#D2463C" },
];

export default function ContratoDiagram() {
  return <DiagramaZoom html={CONTRATO_HTML} legend={LEGEND} initialZoom={0} crop={{ x0: 40, y0: 190, w: 4540, h: 1414, canvasW: 4624, canvasH: 1654 }} />;
}
