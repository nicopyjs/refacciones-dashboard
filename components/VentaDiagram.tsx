"use client";

import DiagramaZoom, { VENTA_LEGEND } from "./DiagramaZoom";
import { VENTA_HTML } from "@/lib/diagramaVentaHtml";

export default function VentaDiagram() {
  return <DiagramaZoom html={VENTA_HTML} legend={VENTA_LEGEND} crop={{ x0: 40, y0: 190, w: 4980, h: 1010, canvasW: 5120, canvasH: 1250 }} />;
}
