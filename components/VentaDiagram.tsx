"use client";

import { useState } from "react";
import { IBM_Plex_Sans } from "next/font/google";
import { VENTA_HTML } from "@/lib/diagramaVentaHtml";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });

// Recorte del lienzo original (5120x1250) sin el título y la leyenda, que se dibujan aparte.
const X0 = 40, Y0 = 190, W = 4980, H = 1010;
const ZOOMS = [0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1];

const LEGEND: { label: string; bg?: string; line?: string; dashed?: boolean; box?: boolean }[] = [
  { label: "Metrogas", bg: "#D9822B" },
  { label: "NEB Chile", bg: "#1F6F8B" },
  { label: "Cliente", bg: "#7B5EA7" },
  { label: "NEB + Cliente", bg: "linear-gradient(135deg, #1F6F8B 50%, #7B5EA7 50%)" },
  { label: "Adjudicado", bg: "#2E9E6A" },
  { label: "Perdido", bg: "#D2463C" },
  { label: "Salida / rechazo", line: "#D2463C" },
  { label: "Proceso en paralelo", box: true },
];

export default function VentaDiagram() {
  const [zi, setZi] = useState(3);
  const s = ZOOMS[zi];

  return (
    <div>
      <div className="venta-bar">
        <div className="legend" style={{ marginTop: 0 }}>
          {LEGEND.map((l) => (
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
            style={{ position: "absolute", left: -X0 * s, top: -Y0 * s, width: 5120, height: 1250, transform: `scale(${s})`, transformOrigin: "0 0", color: "#1F2933" }}
            dangerouslySetInnerHTML={{ __html: VENTA_HTML }}
          />
        </div>
      </div>
    </div>
  );
}
