"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "./TopNav";
import VentaDiagram from "./VentaDiagram";
import ContratoDiagram from "./ContratoDiagram";
import CertificacionDiagram from "./CertificacionDiagram";
import "../app/dashboard.css";
import "../app/diagramas/diagramas.css";

type Side = "left" | "right" | "top" | "bottom";
type EdgeStyle = "solid" | "dot" | "red" | "ok";

type Node = {
  id: string; lane: string; x: number; y: number; w?: number;
  tag?: string; title: string; sub?: string; items?: string[];
  nuevo?: boolean; color?: string; kind?: "hito"; focus?: boolean; link?: string;
};
type Edge = { f: string; t: string; fs?: Side; ts?: Side; fo?: number; to?: number; style?: EdgeStyle; label?: string };
type Spec = {
  width: number;
  phases?: { x0: number; x1: number; label: string }[];
  lanes: { id: string; label: string; color: string; tint: string; h: number }[];
  nodes: Node[];
  edges: Edge[];
};

const C = { teal: "var(--teal)", blue: "var(--blue)", orange: "var(--orange)", slate: "var(--slate)", green: "var(--green)", red: "var(--red)", line: "var(--line)" };

const overview: Spec = {
  width: 1080,
  lanes: [{ id: "ref", label: "Refacciones", color: C.teal, tint: "var(--tint-teal)", h: 260 }],
  nodes: [
    { id: "v", lane: "ref", link: "venta", x: 20, y: 85, tag: "Venta", title: "Venta", sub: "Del prospecto al cierre" },
    { id: "c", lane: "ref", link: "contrato", x: 250, y: 85, tag: "Contrato", title: "Contrato", sub: "Formalización con el cliente" },
    { id: "e", lane: "ref", link: "ejecucion", x: 490, y: 18, tag: "Ejecución", title: "Ejecución", sub: "Obra en terreno" },
    { id: "ce", lane: "ref", link: "certificacion", x: 490, y: 132, tag: "Certificación", title: "Certificación", sub: "Sello Verde, TC5, TE1, GIO y SEREMI" },
    { id: "en", lane: "ref", x: 760, y: 85, w: 210, tag: "Entrega", title: "Entrega y puesta en régimen", sub: "Detalle en el diagrama siguiente", focus: true, link: "detalle" },
  ],
  edges: [{ f: "v", t: "c" }, { f: "c", t: "e" }, { f: "c", t: "ce" }, { f: "e", t: "en" }, { f: "ce", t: "en" }],
};

const detail: Spec = {
  width: 1640,
  phases: [
    { x0: 0, x1: 650, label: "Entrega · máx. 30 días desde el GIO" },
    { x0: 660, x1: 1310, label: "Primeros 3 meses · foco de ingeniería" },
    { x0: 1320, x1: 1540, label: "Mes 3 a 12 · TyP" },
  ],
  lanes: [
    { id: "met", label: "Metrogas", color: C.orange, tint: "var(--tint-orange)", h: 110 },
    { id: "ref", label: "Refacciones", color: C.teal, tint: "var(--tint-teal)", h: 290 },
    { id: "typ", label: "TyP / SSTT", color: C.blue, tint: "var(--tint-blue)", h: 210 },
    { id: "cli", label: "Cliente", color: C.slate, tint: "var(--tint-slate)", h: 110 },
  ],
  nodes: [
    { id: "m1", lane: "met", x: 20, y: 20, tag: "GIO", title: "Revisión GIO", sub: "Evalúa la ejecución (35%)" },
    { id: "m2", lane: "met", x: 320, y: 20, tag: "Certificación", title: "Certificación 15%", sub: "En paralelo, ~2 semanas" },
    { id: "r1", lane: "ref", x: 20, y: 20, kind: "hito", title: "Hito 0: facturación 35%", sub: "La emite Refacciones" },
    { id: "r3", lane: "ref", x: 240, y: 20, tag: "Ing. planificación", title: "Informe interno", items: ["Todo lo realizado", "Qué tiene garantía y qué no"] },
    { id: "r2", lane: "ref", x: 240, y: 150, tag: "Ing. planificación", title: "Documento de entrega", items: ["Antes y después con fotos", "Plano as-built"] },
    { id: "r5", lane: "ref", x: 460, y: 20, tag: "Refacciones", nuevo: true, title: "Traspaso técnico a TyP", sub: "Operación de la sala, ubicación y función de cada sensor" },
    { id: "r4", lane: "ref", x: 460, y: 150, tag: "Refacciones", nuevo: true, title: "Capacitación al personal", sub: "Con el supervisor de mantenimiento de TyP" },
    { id: "r6", lane: "ref", x: 860, y: 150, w: 200, tag: "Garantía", color: C.red, title: "Resolver garantía", items: ["24 h si afecta el ACS", "Si no, en la próxima mantención", "TyP si Refacciones no puede"] },
    { id: "r7", lane: "ref", x: 1120, y: 20, tag: "Ing. planificación", title: "Informe de eficiencia", sub: "Mes 3, siempre se emite" },
    { id: "t1", lane: "typ", x: 680, y: 20, tag: "TyP", title: "Mantención mensual", sub: "La 1ª es revisión general" },
    { id: "t2", lane: "typ", x: 920, y: 20, tag: "Supervisor TyP", nuevo: true, title: "Feedback del mantenedor", sub: "Qué le falta a la sala, por correo o llamada" },
    { id: "t4", lane: "typ", x: 1340, y: 20, tag: "TyP", title: "Postventa hasta mes 12", sub: "Garantías de instalación" },
    { id: "t5", lane: "typ", x: 1340, y: 120, tag: "Servicio técnico", title: "Mantención regular", sub: "Desde el año 1" },
    { id: "c1", lane: "cli", x: 240, y: 20, tag: "Cliente", title: "Recibe documento de entrega" },
    { id: "c2", lane: "cli", x: 460, y: 20, tag: "Personal del edificio", title: "Personal capacitado", sub: "Conoce al supervisor a cargo" },
    { id: "c3", lane: "cli", x: 1120, y: 20, tag: "Cliente", title: "Recibe informe de eficiencia" },
  ],
  edges: [
    { f: "m1", t: "r1" },
    { f: "m1", t: "m2", style: "dot", label: "En paralelo" },
    { f: "r1", t: "r3" }, { f: "r1", t: "r2" },
    { f: "r3", t: "r5" }, { f: "r2", t: "r4" },
    { f: "r5", t: "t1" },
    { f: "r2", t: "c1", style: "dot" }, { f: "r4", t: "c2", style: "dot" },
    { f: "t1", t: "t2" },
    { f: "t1", t: "r6", fs: "top", ts: "left", fo: -40, style: "red", label: "Hallazgo" },
    { f: "r6", t: "t1", fs: "bottom", ts: "top", fo: -60, to: 40, style: "ok", label: "Corregido" },
    { f: "t2", t: "r7", label: "Mes 3" },
    { f: "r7", t: "r6", fs: "bottom", ts: "right", fo: -40, style: "red", label: "Resultados bajos" },
    { f: "r7", t: "c3", style: "dot" },
    { f: "r7", t: "t4" }, { f: "t4", t: "t5" },
  ],
};

const TITULOS: Record<string, string> = { venta: "Venta", contrato: "Contrato", ejecucion: "Ejecución", certificacion: "Certificación" };

const STYLES: Record<EdgeStyle, { stroke: string; dash: string; w: number }> = {
  solid: { stroke: C.line, dash: "", w: 1.5 },
  dot: { stroke: C.line, dash: "2 4", w: 1.6 },
  red: { stroke: C.red, dash: "5 4", w: 1.5 },
  ok: { stroke: C.green, dash: "", w: 1.6 },
};

type Pt = [number, number];
type Box = { l: number; t: number; r: number; b: number; cx: number };

function port(b: Box, side: Side, off = 0): Pt {
  // Los puertos laterales quedan a la altura del título, para que tarjetas alineadas queden con líneas rectas.
  const y = Math.min((b.t + b.b) / 2, b.t + 28);
  if (side === "left") return [b.l, y];
  if (side === "right") return [b.r, y];
  if (side === "top") return [b.cx + off, b.t];
  return [b.cx + off, b.b];
}

function route(p: Pt, q: Pt, fs: Side, ts: Side): Pt[] {
  const fh = fs === "left" || fs === "right";
  const th = ts === "left" || ts === "right";
  let pts: Pt[];
  if (fh && th) { const mx = (p[0] + q[0]) / 2; pts = [p, [mx, p[1]], [mx, q[1]], q]; }
  else if (!fh && !th) { const my = (p[1] + q[1]) / 2; pts = [p, [p[0], my], [q[0], my], q]; }
  else if (fh) pts = [p, [q[0], p[1]], q];
  else pts = [p, [p[0], q[1]], q];
  return pts.filter((pt, i) => i === 0 || pt[0] !== pts[i - 1][0] || pt[1] !== pts[i - 1][1]);
}

function rounded(pts: Pt[], R = 9): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y);
    const r = Math.min(R, l1 / 2, l2 / 2);
    d += ` L${x - ((x - px) / l1) * r} ${y - ((y - py) / l1) * r} Q${x} ${y} ${x + ((nx - x) / l2) * r} ${y + ((ny - y) / l2) * r}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last[0]} ${last[1]}`;
}

type Drawn = { d: string; style: EdgeStyle; label?: { x: number; y: number; text: string; anchor: "middle" | "start" } };

function Diagram({ spec, onOpen }: { spec: Spec; onOpen?: (link: string) => void }) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState<Drawn[]>([]);
  const [size, setSize] = useState<[number, number]>([spec.width, 0]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => {
      const cr = el.getBoundingClientRect();
      const boxes: Record<string, Box> = {};
      el.querySelectorAll<HTMLElement>("[data-id]").forEach((n) => {
        const r = n.getBoundingClientRect();
        boxes[n.dataset.id!] = { l: r.left - cr.left, t: r.top - cr.top, r: r.right - cr.left, b: r.bottom - cr.top, cx: (r.left + r.right) / 2 - cr.left };
      });
      const out: Drawn[] = [];
      for (const e of spec.edges) {
        const a = boxes[e.f], b = boxes[e.t];
        if (!a || !b) continue;
        let fs = e.fs, ts = e.ts;
        if (!fs || !ts) {
          if (b.l >= a.r - 2) { fs = "right"; ts = "left"; }
          else if (b.t >= a.b) { fs = "bottom"; ts = "top"; }
          else if (b.b <= a.t) { fs = "top"; ts = "bottom"; }
          else { fs = "left"; ts = "right"; }
        }
        const pts = route(port(a, fs, e.fo), port(b, ts, e.to), fs, ts);
        let label: Drawn["label"];
        if (e.label) {
          let bi = 0, best = -1;
          for (let i = 0; i < pts.length - 1; i++) {
            const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
            if (len > best) { best = len; bi = i; }
          }
          const [x1, y1] = pts[bi], [x2, y2] = pts[bi + 1];
          label = y1 === y2
            ? { x: (x1 + x2) / 2, y: y1 - 6, text: e.label, anchor: "middle" }
            : { x: x1 + 7, y: (y1 + y2) / 2 + 3, text: e.label, anchor: "start" };
        }
        out.push({ d: rounded(pts), style: e.style ?? "solid", label });
      }
      setDrawn(out);
      setSize([el.scrollWidth, el.scrollHeight]);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    document.fonts?.ready.then(compute);
    return () => ro.disconnect();
  }, [spec]);

  const laneColor = (id: string) => spec.lanes.find((l) => l.id === id)!.color;

  return (
    <div className="canvas" ref={ref} style={{ width: spec.width }}>
      {spec.phases && (
        <div className="phases">
          {spec.phases.map((p) => (
            <div key={p.label} className="phase" style={{ left: p.x0, width: p.x1 - p.x0 }}>{p.label}</div>
          ))}
        </div>
      )}
      {spec.lanes.map((l) => (
        <div className="lane" key={l.id}>
          <div className="lanelabel"><div className="in"><b>{l.label}</b><i style={{ background: l.color }} /></div></div>
          <div className="lanebody" style={{ height: l.h, background: l.tint }}>
            {spec.nodes.filter((n) => n.lane === l.id).map((n) => {
              const style = { left: n.x, top: n.y, width: n.w ?? 180, ["--c" as string]: n.kind === "hito" ? C.green : n.color ?? laneColor(l.id) };
              if (n.kind === "hito") {
                return (
                  <div key={n.id} data-id={n.id} className="card hito" style={style}>
                    <span className="ck">✓</span>
                    <div><div className="t">{n.title}</div>{n.sub && <div className="s">{n.sub}</div>}</div>
                  </div>
                );
              }
              const body = (
                <>
                  {n.tag && <span className="tag">{n.tag}</span>}
                  {n.nuevo && <span className="new">Nuevo</span>}
                  <div className="t">{n.title}</div>
                  {n.sub && <div className="s">{n.sub}</div>}
                  {n.items && <ul>{n.items.map((i) => <li key={i}>{i}</li>)}</ul>}
                  {n.link && <span className="go">Ver detalle →</span>}
                </>
              );
              return n.link && onOpen ? (
                <button key={n.id} type="button" data-id={n.id} className={`card${n.focus ? " focus" : ""}`} style={style} onClick={() => onOpen(n.link!)}>{body}</button>
              ) : (
                <div key={n.id} data-id={n.id} className={`card${n.focus ? " focus" : ""}`} style={style}>{body}</div>
              );
            })}
          </div>
        </div>
      ))}
      <svg className="edges" width={size[0]} height={size[1]} aria-hidden="true">
        <defs>
          {(Object.keys(STYLES) as EdgeStyle[]).map((k) => (
            <marker key={k} id={`${uid}-a-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto">
              <path d="M1 1L9.5 5L1 9z" fill={STYLES[k].stroke} />
            </marker>
          ))}
        </defs>
        {drawn.map((e, i) => {
          const s = STYLES[e.style];
          return (
            <g key={i}>
              <path d={e.d} fill="none" stroke={s.stroke} strokeWidth={s.w} strokeDasharray={s.dash || undefined} markerEnd={`url(#${uid}-a-${e.style})`} />
              {e.label && <text x={e.label.x} y={e.label.y} textAnchor={e.label.anchor} fill={s.stroke === C.line ? "var(--muted)" : s.stroke}>{e.label.text}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function DiagramasDashboard() {
  const router = useRouter();
  const [view, setView] = useState<string>("general");

  useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="dg">
      <div className="navwrap viz-root"><TopNav active="diagramas" /></div>
      <div className="wrap">
        <header className="top">
          <div className="titles">
            <h1>Diagramas del área de Refacciones</h1>
            <p className="lede">Flujo general del área y detalle de la entrega y puesta en régimen: responsables, plazos y qué se entrega al cliente.</p>
            <div className="legend">
              <span><i className="sw" style={{ background: "var(--teal)" }} />Refacciones</span>
              <span><i className="sw" style={{ background: "var(--blue)" }} />TyP / Servicio técnico</span>
              <span><i className="sw" style={{ background: "var(--orange)" }} />Metrogas</span>
              <span><i className="sw" style={{ background: "var(--slate)" }} />Cliente</span>
              <span><i className="sw" style={{ background: "var(--green)" }} />Hito de facturación</span>
              <span><i className="ln" />Garantía / hallazgo</span>
              <span><i className="ln ok" />Corregido</span>
              <span><i className="ln dot" />Entregable</span>
            </div>
          </div>
          <button type="button" className="backbtn" style={{ marginBottom: 0 }} onClick={logout}>Cerrar sesión</button>
        </header>

        {view === "general" ? (
          <section className="fade" key="general">
            <h2>Flujo general del área</h2>
            <p className="sub">La certificación corre en paralelo a la ejecución y tiene su propio diagrama. Ambas convergen en la entrega y puesta en régimen. Haz click en una etapa para ver su detalle.</p>
            <div className="scroller"><Diagram spec={overview} onOpen={setView} /></div>
          </section>
        ) : view === "venta" ? (
          <section className="fade" key="venta">
            <button type="button" className="backbtn" onClick={() => setView("general")}>← Volver al flujo general</button>
            <h2>Venta</h2>
            <p className="sub">Proceso comercial de refacción de salas de calderas, desde la derivación de Metrogas hasta la adjudicación.</p>
            <VentaDiagram />
          </section>
        ) : view === "contrato" ? (
          <section className="fade" key="contrato">
            <button type="button" className="backbtn" onClick={() => setView("general")}>← Volver al flujo general</button>
            <h2>Contrato</h2>
            <p className="sub">Proceso de contratos: desde la elaboración de borradores hasta la firma electrónica y la entrega de los contratos definitivos.</p>
            <ContratoDiagram />
          </section>
        ) : view === "certificacion" ? (
          <section className="fade" key="certificacion">
            <button type="button" className="backbtn" onClick={() => setView("general")}>← Volver al flujo general</button>
            <h2>Certificación</h2>
            <p className="sub">Tres procesos en paralelo (Sello Verde / TC5 / TE1, terminaciones y GIO, y registro ante la SEREMI) que convergen en la inscripción y los códigos de facturación.</p>
            <CertificacionDiagram />
          </section>
        ) : view !== "detalle" ? (
          <section className="fade" key={view}>
            <button type="button" className="backbtn" onClick={() => setView("general")}>← Volver al flujo general</button>
            <h2>{TITULOS[view] ?? view}</h2>
            <p className="sub">El diagrama detallado de esta etapa aún no está disponible.</p>
          </section>
        ) : (
          <section className="fade" key="detalle">
            <button type="button" className="backbtn" onClick={() => setView("general")}>← Volver al flujo general</button>
            <h2>Entrega y puesta en régimen</h2>
            <p className="sub">Parte con la revisión GIO y la facturación del 35%. Refacciones mantiene el foco de ingeniería los primeros 3 meses; TyP sigue hasta el mes 12 y luego pasa a Servicio técnico.</p>
            <div className="scroller"><Diagram spec={detail} /></div>
            <p className="note">Garantías: se informan siempre a Refacciones; si no puede tomarlas, las ejecuta TyP. Se resuelven en 24 h si está en riesgo el agua caliente sanitaria; si no, a más tardar en la próxima mantención.</p>
          </section>
        )}
      </div>
    </div>
  );
}
