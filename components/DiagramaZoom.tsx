"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Zoom con la rueda del mouse, anclado en el punto bajo el cursor.
  const ziRef = useRef(zi);
  const anchor = useRef<{ x: number; y: number; cx: number; from: number } | null>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) < 60) return;
      const dir = acc < 0 ? 1 : -1;
      acc = 0;
      const cur = ziRef.current;
      const next = Math.min(ZOOMS.length - 1, Math.max(0, cur + dir));
      if (next === cur) return;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      anchor.current = { x: (el.scrollLeft + cx) / ZOOMS[cur], y: (e.clientY - rect.top) / ZOOMS[cur], cx, from: ZOOMS[cur] };
      ziRef.current = next;
      setZi(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  useLayoutEffect(() => {
    ziRef.current = zi;
    const a = anchor.current;
    const el = scrollerRef.current;
    if (!a || !el) return;
    anchor.current = null;
    el.scrollLeft = a.x * ZOOMS[zi] - a.cx;
    window.scrollBy(0, a.y * (ZOOMS[zi] - a.from));
  }, [zi]);

  // Arrastrar con el mouse para moverse por el diagrama (en táctil ya funciona el scroll nativo).
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !scrollerRef.current) return;
    scrollerRef.current.scrollLeft -= e.clientX - d.x;
    window.scrollBy(0, -(e.clientY - d.y));
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

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
      <div
        ref={scrollerRef}
        className="scroller venta-scroller"
        style={{ cursor: dragging ? "grabbing" : "grab", userSelect: "none", touchAction: "pan-x pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
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
