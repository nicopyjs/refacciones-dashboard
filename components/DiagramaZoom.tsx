"use client";

import { useState } from "react";
import { IBM_Plex_Sans } from "next/font/google";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });

const ZOOMS = [0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1];

export type LegendItem = { label: string; bg?: string; line?: string; dashed?: boolean; box?: boolean };

export const VENTA_LEGEND: LegendItem[] = [
  { label: "Metrogas", bg: "#D9822B" },
  { label: "NEB Chile", bg: "#1F6F8B" },
  { label: "Cliente", bg: "#7B5EA7" },
  { label: "NEB + Cliente", bg: "linear-gradient(135deg, #1F6F8B 50%, #7B5EA7 50%)" },
  { label: "Adjudicado", bg: "#2E9E6A" },
  { label: "Perdido", bg: "#D2463C" },
  { label: "Salida / rechazo", line: "#D2463C" },
  { label: "Proceso en paralelo", box: true },
];

export type DiagramaZoomProps = {
  html: string;
  legend: LegendItem[];
  // Recorte del lienzo original sin el título y la leyenda, que se dibujan aparte.
  crop: { x0: number; y0: number; w: number; h: number; canvasW: number; canvasH: number };
  initialZoom?: number;
};

export default function DiagramaZoom({ html, legend, crop, initialZoom = 3 }: DiagramaZoomProps) {
  const { x0: X0, y0: Y0, w: W, h: H, canvasW, canvasH } = crop;
  const [zi, setZi] = useState(initialZoom);
  const s = ZOOMS[zi];

  return (
    <div>
      <div className="venta-bar">
        <div className="legend" style={{ marginTop: 0 }}>
          {legend.map((l) => (
            <span key={l.label}>
              {l.line ? <i className="ln" style={{ borderTopColor: l.line }} />
                : l.box ? <i className="sw" style={{ width: 22, height: 10, border: "1.5px dashed var(--muted)", background: "transparent" }} />
                : <i className="sw" style={{ background: l.bg }} />}
              {l.label}
            </span>
          ))}
        </div>
        <div className="zoom" role="group" aria-label="Zoom del diagrama">
          <button type="button" onClick={() => setZi((z) => Math.max(0, z - 1))} disabled={zi === 0} aria-label="Alejar">−</button>
          <span>{Math.round(s * 100)}%</span>
          <button type="button" onClick={() => setZi((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zi === ZOOMS.length - 1} aria-label="Acercar">+</button>
        </div>
      </div>
      <div className="scroller venta-scroller">
        <div style={{ width: W * s, height: H * s, position: "relative", background: "#fff", borderRadius: 14, overflow: "hidden" }}>
          <div
            className={plex.className}
            style={{ position: "absolute", left: -X0 * s, top: -Y0 * s, width: canvasW, height: canvasH, transform: `scale(${s})`, transformOrigin: "0 0", color: "#1F2933" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
