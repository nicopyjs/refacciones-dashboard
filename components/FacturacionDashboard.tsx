"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import type { FacturacionData, FacturacionItem, FacturacionStatus } from "@/lib/parseFacturacion";
import TopNav from "./TopNav";
import "../app/dashboard.css";
import "../app/facturacion/facturacion.css";

const archivo = Archivo({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-archivo", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mName = (k: string) => { const [y, m] = k.split("-"); return `${MES[+m - 1]} ${y}`; };
const mShort = (k: string) => { const [y, m] = k.split("-"); return `${MES3[+m - 1]} ${y.slice(2)}`; };
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const mm = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return "$" + (n / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " M";
  if (a >= 1e3) return "$" + Math.round(n / 1e3).toLocaleString("es-CL") + " mil";
  return clp(n);
};
const STATUS_LABEL: Record<FacturacionStatus, string> = { fact: "facturado", esp: "esperando códigos", proy: "proyección" };
const COLOR_FROM = "2026-01";

type Item = FacturacionItem & { code: string; name: string };
type Agg = { fact: number; esp: number; proy: number };
type Note = { chip: "bad" | "esp" | "fact"; title: string; detail?: string };

export default function FacturacionDashboard({
  data,
  todayKey,
  generatedAt,
  error,
}: {
  data: FacturacionData | null;
  todayKey: string;
  generatedAt: string;
  error: string | null;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <div className="viz-root" style={{ minHeight: 0 }}>
        <div className="wrap" style={{ paddingBottom: 0 }}>
          <TopNav active="facturacion" />
        </div>
      </div>
      <div className={`rct ${archivo.variable} ${plex.variable} ${plexMono.variable}`}>
        <div className="wrap">
          <header className="top">
            <div>
              <div className="brand-eyebrow">NEB Chile · Refacciones RCT</div>
              <h1>Facturación del mes</h1>
            </div>
            <div className="controls">
              <button
                type="button"
                className="btn"
                disabled={refreshing}
                onClick={() => { setRefreshing(true); router.refresh(); setTimeout(() => setRefreshing(false), 1500); }}
              >
                {refreshing ? "Actualizando…" : "Actualizar desde Drive"}
              </button>
              <button type="button" className="btn" onClick={logout}>Cerrar sesión</button>
            </div>
          </header>
          {error || !data ? (
            <div className="source">
              <span className="dot err" />
              <span>{error ?? "No se pudo leer el Excel."}</span>
            </div>
          ) : (
            <Board data={data} todayKey={todayKey} generatedAt={generatedAt} />
          )}
        </div>
      </div>
    </>
  );
}

function Board({ data, todayKey, generatedAt }: { data: FacturacionData; todayKey: string; generatedAt: string }) {
  const keys = useMemo(() => data.months.filter((k) => k >= "2025-01"), [data]);
  const [selRaw, setSel] = useState(todayKey);
  const sel = keys.includes(selRaw) ? selRaw : keys.includes(todayKey) ? todayKey : keys[keys.length - 1];
  const [tab, setTab] = useState<"mes" | "obs">("mes");

  const items: Item[] = useMemo(
    () => data.projects.flatMap((p) => p.items.map((i) => ({ ...i, code: p.code, name: p.name }))),
    [data]
  );
  const agg = useMemo(() => {
    const a: Record<string, Agg> = {};
    for (const k of data.months) a[k] = { fact: 0, esp: 0, proy: 0 };
    for (const i of items) a[i.month][i.status] += i.amount;
    return a;
  }, [data, items]);

  const a = agg[sel] ?? { fact: 0, esp: 0, proy: 0 };
  const tot = a.fact + a.esp + a.proy;
  const pct = tot ? Math.round((a.fact / tot) * 100) : 0;
  const isCur = sel === todayKey, isPast = sel < todayKey;
  const mItems = items.filter((i) => i.month === sel);
  const count = (s: FacturacionStatus) => mItems.filter((i) => i.status === s).length;

  const idx = keys.indexOf(sel);

  return (
    <>
      <div className="controls" style={{ justifyContent: "space-between", paddingBlock: "10px 0" }}>
        <div className="source" style={{ padding: 0 }}>
          <span className="dot live" />
          <span>En vivo desde Google Drive · Facturacion Real · leído {new Date(generatedAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="monthnav">
          <button type="button" aria-label="Mes anterior" disabled={idx <= 0} onClick={() => setSel(keys[idx - 1])}>‹</button>
          <select aria-label="Mes" value={sel} onChange={(e) => setSel(e.target.value)}>
            {keys.map((k) => <option key={k} value={k}>{mName(k)}</option>)}
          </select>
          <button type="button" aria-label="Mes siguiente" disabled={idx >= keys.length - 1} onClick={() => setSel(keys[idx + 1])}>›</button>
        </div>
      </div>

      <div className="summary">
        <div className="panel">
          <div className="label">Total {mName(sel)}</div>
          <div className="hero num">{mm(tot)}</div>
          <div className="sub">
            {tot ? `${pct}% ya facturado · ${isCur ? "mes en curso" : isPast ? "mes cerrado" : "mes futuro"}` : "Sin montos este mes"}
          </div>
          <div className="segbar" aria-hidden="true">
            {(["fact", "esp", "proy"] as const).map((s) => (
              <span key={s} className={`s-${s}`} hidden={!a[s]} style={{ flexGrow: a[s], flexBasis: 0 }} />
            ))}
          </div>
        </div>
        <div className="kpis">
          <div className="kpi"><span className="chip fact"><i />Facturado</span><div className="v num">{mm(a.fact)}</div><div className="who">{count("fact")} ítems</div></div>
          <div className="kpi"><span className="chip esp"><i />Esperando códigos</span><div className="v num">{mm(a.esp)}</div><div className="who">{count("esp")} ítems · depende del cliente</div></div>
          <div className="kpi"><span className="chip proy"><i />Por facturar</span><div className="v num">{mm(a.proy)}</div><div className="who">{count("proy")} ítems · depende de NEB</div></div>
        </div>
      </div>

      <Buscar items={items} sel={sel} />

      <section>
        <h2>Cómo vienen los meses</h2>
        <p className="h2sub">Facturación por mes según el color de cada celda. La línea amarilla marca el mes seleccionado.</p>
        <div className="panel">
          <div className="legend">
            <span><i className="s-fact" />Facturado</span>
            <span><i className="s-esp" />Esperando códigos</span>
            <span><i className="s-proy" />Proyección</span>
          </div>
          <Chart months={data.months} agg={agg} sel={sel} onSelect={setSel} />
        </div>
      </section>

      <Matrix data={data} sel={sel} todayKey={todayKey} />

      <Control data={data} agg={agg} items={items} sel={sel} todayKey={todayKey} tab={tab} setTab={setTab} />

      <footer>
        Fuente: pestaña &quot;Facturacion Real&quot; de PROYECCION REFACCION.xlsx (Google Drive). Verde = facturado, amarillo = listo esperando códigos del cliente, blanco = proyección. El arrastre considera meses desde enero 2026, que es desde cuando se usan los colores.
      </footer>
    </>
  );
}

function Row({ i }: { i: Item }) {
  return (
    <div className="row">
      <div>
        <div className="p">{i.name}</div>
        <div className="c">{i.code ? `${i.code} · ` : ""}{i.concept} · celda {i.cell}</div>
      </div>
      <div className="a num">{clp(i.amount)}</div>
    </div>
  );
}

function Buscar({ items, sel }: { items: Item[]; sel: string }) {
  const byAmount = (x: Item, y: Item) => y.amount - x.amount;
  const esp = items.filter((i) => i.month === sel && i.status === "esp").sort(byAmount);
  const proy = items.filter((i) => i.month === sel && i.status === "proy").sort(byAmount);
  const sum = (arr: { amount: number }[]) => arr.reduce((s, i) => s + i.amount, 0);

  const arrItems = items.filter((i) => i.month >= COLOR_FROM && i.month < sel && i.status !== "fact");
  const groups = Object.values(
    arrItems.reduce<Record<string, Item & { months: string[]; cells: string[] }>>((g, i) => {
      const id = `${i.code}|${i.name}|${i.concept}`;
      const e = (g[id] ??= { ...i, amount: 0, months: [], cells: [] });
      e.amount += i.amount;
      e.months.push(mShort(i.month));
      e.cells.push(i.cell);
      return g;
    }, {})
  ).sort((x, y) => y.amount - x.amount);

  return (
    <section>
      <h2>Qué ir a buscar</h2>
      <p className="h2sub">Montos de {mName(sel)} que todavía no están en verde.</p>
      <div className="cols">
        <div className="panel">
          <div className="listhead"><span className="chip esp"><i />Pedir códigos al cliente</span><span className="tot num">{esp.length ? mm(sum(esp)) : ""}</span></div>
          <div className="list">
            {esp.length ? esp.map((i, n) => <Row key={n} i={i} />) : <div className="empty">Nada esperando códigos este mes.</div>}
          </div>
        </div>
        <div className="panel">
          <div className="listhead"><span className="chip proy"><i />NEB debe gestionar</span><span className="tot num">{proy.length ? mm(sum(proy)) : ""}</span></div>
          <div className="list">
            {proy.length ? proy.map((i, n) => <Row key={n} i={i} />) : <div className="empty">Todo lo proyectado ya está facturado o en espera.</div>}
          </div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="listhead"><span className="chip bad"><i />Arrastre de meses anteriores</span><span className="tot num">{groups.length ? mm(sum(arrItems)) : ""}</span></div>
        <p className="h2sub" style={{ margin: "0 0 6px" }}>Montos de meses ya cerrados (desde enero 2026) que siguen en blanco o amarillo. Si ya se facturaron, falta pintarlos verde en el Excel.</p>
        <div className="list">
          {groups.length ? groups.map((g, n) => (
            <div className="row" key={n}>
              <div>
                <div className="p">{g.name}</div>
                <div className="c">{g.code ? `${g.code} · ` : ""}{g.concept} · {g.months.join(", ")} · celdas {g.cells.join(", ")}</div>
              </div>
              <div className="a num">{clp(g.amount)}</div>
            </div>
          )) : <div className="empty">Sin arrastre: todo lo de meses anteriores está en verde.</div>}
        </div>
      </div>
    </section>
  );
}

function Chart({ months, agg, sel, onSelect }: { months: string[]; agg: Record<string, Agg>; sel: string; onSelect: (k: string) => void }) {
  const [tip, setTip] = useState<{ k: string; x: number; y: number } | null>(null);
  const last = [...months].reverse().find((k) => agg[k].fact + agg[k].esp + agg[k].proy > 0) ?? sel;
  const keys = months.filter((k) => k >= COLOR_FROM && k <= last);
  const W = 1000, H = 340, L = 64, R = 12, T = 16, B = 40;
  const max = Math.max(1, ...keys.map((k) => agg[k].fact + agg[k].esp + agg[k].proy));
  const step = [10e6, 20e6, 25e6, 50e6, 100e6].find((s) => max / s <= 6) || 50e6;
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const bw = (W - L - R) / keys.length;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const tipAgg = tip ? agg[tip.k] : null;

  return (
    <div className="chartbox">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Facturación mensual apilada por estado">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--proy-soft)" />
            <rect width="1.6" height="6" fill="var(--proy)" />
          </pattern>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{v ? v / 1e6 + " M" : "0"}</text>
          </g>
        ))}
        {keys.map((k, idx) => {
          const ag = agg[k], x = L + idx * bw, w = Math.max(6, bw * 0.62), cx = x + (bw - w) / 2;
          let base = 0;
          const segs = ([["fact", "var(--fact)"], ["esp", "var(--esp)"], ["proy", "url(#hatch)"]] as const).filter(([s]) => ag[s] > 0);
          return (
            <g key={k}>
              {k === sel && <rect x={x + 1} y={T - 6} width={bw - 2} height={H - T - B + 6} fill="var(--brand)" opacity={0.16} rx={4} />}
              {segs.map(([s, fill], j) => {
                const y0 = y(base), y1 = y(base + ag[s]);
                base += ag[s];
                const h = Math.max(0, y0 - y1 - (j < segs.length - 1 ? 2 : 0));
                if (j === segs.length - 1 && h > 4) {
                  const r = 4;
                  return <path key={s} fill={fill} d={`M${cx},${y0} V${y1 + r} Q${cx},${y1} ${cx + r},${y1} H${cx + w - r} Q${cx + w},${y1} ${cx + w},${y1 + r} V${y0} Z`} />;
                }
                return <rect key={s} x={cx} y={y0 - h} width={w} height={h} fill={fill} />;
              })}
              <text x={x + bw / 2} y={H - B + 18} textAnchor="middle" fontSize={11} fill={k === sel ? "var(--ink)" : "var(--muted)"} fontWeight={k === sel ? 600 : 400}>{mShort(k)}</text>
              <rect
                x={x} y={T} width={bw} height={H - T - B} fill="transparent" style={{ cursor: "pointer" }}
                onMouseMove={(ev) => {
                  const box = ev.currentTarget.ownerSVGElement!.parentElement!.getBoundingClientRect();
                  let tx = ev.clientX - box.left + 14;
                  if (tx + 210 > box.width) tx = ev.clientX - box.left - 220;
                  setTip({ k, x: tx, y: ev.clientY - box.top + 10 });
                }}
                onMouseLeave={() => setTip(null)}
                onClick={() => onSelect(k)}
              />
            </g>
          );
        })}
      </svg>
      {tip && tipAgg && (
        <div className="tip" style={{ left: tip.x, top: tip.y }}>
          <b>{mName(tip.k)}</b>
          {([["Facturado", tipAgg.fact], ["Esperando códigos", tipAgg.esp], ["Proyección", tipAgg.proy], ["Total", tipAgg.fact + tipAgg.esp + tipAgg.proy]] as const).map(([n, v]) => (
            <div className="l num" key={n}><span>{n}</span><span>{clp(v)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function Matrix({ data, sel, todayKey }: { data: FacturacionData; sel: string; todayKey: string }) {
  const i0 = data.months.indexOf(sel);
  const keys = data.months.slice(i0, i0 + 6);
  const colTot = keys.map(() => 0);
  const rows = data.projects
    .map((p) => {
      const cells = keys.map((k) => {
        const its = p.items.filter((i) => i.month === k);
        return { v: its.reduce((s, i) => s + i.amount, 0), st: new Set(its.map((i) => i.status)), its };
      });
      return { p, cells, tot: cells.reduce((s, c) => s + c.v, 0) };
    })
    .filter((r) => r.tot > 0)
    .sort((x, y) => y.tot - x.tot);
  rows.forEach((r) => r.cells.forEach((c, j) => { colTot[j] += c.v; }));

  return (
    <section>
      <h2>Detalle por proyecto</h2>
      <p className="h2sub">Seis meses desde el mes seleccionado. Verde facturado, amarillo esperando códigos, blanco proyección.</p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Proyecto</th>
              {keys.map((k) => <th key={k} className={k === todayKey ? "cur" : ""}>{mShort(k)}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.row}>
                <td><div className="pn">{r.p.name}</div><div className="pc">{r.p.code || "sin código"}</div></td>
                {r.cells.map((c, j) => {
                  const cls = !c.v ? "" : c.st.size > 1 ? (c.st.has("proy") ? "proy" : "mix") : [...c.st][0];
                  const title = c.v ? c.its.map((i) => `${i.concept}: ${clp(i.amount)} (${STATUS_LABEL[i.status]})`).join("\n") : undefined;
                  return <td key={j} className={`num ${cls}`} title={title}>{c.v ? mm(c.v) : "·"}</td>;
                })}
                <td className="num">{mm(r.tot)}</td>
              </tr>
            ))}
            <tr className="tot">
              <td>Total ({rows.length} proyectos)</td>
              {colTot.map((v, j) => <td key={j} className="num">{mm(v)}</td>)}
              <td className="num">{mm(colTot.reduce((s, v) => s + v, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Control({
  data, agg, items, sel, todayKey, tab, setTab,
}: {
  data: FacturacionData; agg: Record<string, Agg>; items: Item[]; sel: string; todayKey: string;
  tab: "mes" | "obs"; setTab: (t: "mes" | "obs") => void;
}) {
  const R = data.rows;
  const total = (k: string) => agg[k].fact + agg[k].esp + agg[k].proy;
  const keys = data.months.filter((k) => k >= COLOR_FROM && (total(k) > 0 || data.excel[k]?.real));

  const notes = useMemo(() => {
    const out: Note[] = [];
    const miss: Record<string, { months: string[]; amt: number }> = {};
    for (const k of keys) for (const m of data.excel[k]?.missing ?? []) {
      const e = (miss[`${m.code} ${m.name}`] ??= { months: [], amt: 0 });
      e.months.push(mShort(k));
      e.amt += m.amount;
    }
    for (const [id, v] of Object.entries(miss))
      out.push({ chip: "bad", title: `${id} no está sumado en la fila ${R.real} REAL en ${v.months.length} mes(es).`, detail: `Meses: ${v.months.join(", ")}. Queda fuera ${clp(v.amt)} en total.` });

    for (const p of data.projects) {
      const bad = data.months.filter((k) => Math.abs(p.items.filter((i) => i.month === k).reduce((s, i) => s + i.amount, 0) - (p.header[k] || 0)) > 2);
      if (bad.length)
        out.push({ chip: "bad", title: `La fila celeste de ${p.code} ${p.name} (fila ${p.row}) no suma sus líneas en ${bad.length} mes(es).`, detail: `Meses: ${bad.map(mShort).join(", ")}. Revisar que la fórmula SUM exista y abarque las 4 líneas.` });
    }

    const byP: Record<string, string[]> = {};
    items.filter((i) => i.status === "fact" && i.month > todayKey).forEach((i) => { (byP[`${i.code ? i.code + " " : ""}${i.name}`] ??= []).push(mShort(i.month)); });
    for (const [id, ms] of Object.entries(byP))
      out.push({ chip: "esp", title: `${id} tiene montos en verde en meses que aún no llegan.`, detail: `Meses: ${ms.join(", ")}. Si no están facturados, dejarlos en blanco para que cuenten como proyección.` });

    for (const k of keys) {
      const x = data.excel[k]?.crossRefs ?? [];
      if (x.length) out.push({ chip: "bad", title: `La fila ${R.real} REAL de ${mName(k)} suma ${x.join(", ")}, que es de otra columna.`, detail: `Quitar ${x.join(", ")} de la fórmula de ${mName(k)}; ese monto ya está en su propio mes.` });
    }

    const brk: Record<number, { label: string; faltan: Record<string, string[]>; sobran: Set<string> }> = {};
    for (const k of keys) for (const b of data.excel[k]?.breakdown ?? []) {
      const e = (brk[b.row] ??= { label: b.label, faltan: {}, sobran: new Set() });
      b.faltan.forEach((f) => { (e.faltan[`${f.code ? f.code + " " : ""}${f.name}`] ??= []).push(f.cell); });
      b.sobran.forEach((s) => e.sobran.add(`${s.code ? s.code + " " : ""}${s.name}`));
    }
    for (const [row, e] of Object.entries(brk)) {
      const parts = Object.entries(e.faltan).map(([id, cells]) => `${id} (${cells.join(", ")})`);
      if (parts.length) out.push({ chip: "bad", title: `La fila ${row} ${e.label} no suma todas las líneas.`, detail: `Faltan: ${parts.join("; ")}.` });
      if (e.sobran.size)
        out.push({ chip: "esp", title: `La fila ${row} ${e.label} suma la fila celeste de ${[...e.sobran].join(" y ")} en vez de su línea de ${e.label.toLowerCase()}.`, detail: `Hoy da el mismo número porque esas filas celestes solo tienen cuotas, pero si se agrega otro monto a ese proyecto se contaría dos veces en la fila ${R.total} TOTAL.` });
    }
    const diffTot = keys.filter((k) => Math.abs((data.excel[k]?.total ?? 0) - (data.excel[k]?.real ?? 0)) > 5);
    if (diffTot.length && !Object.keys(brk).length)
      out.push({ chip: "bad", title: `Las filas ${R.real} REAL y ${R.total} TOTAL dan distinto en ${diffTot.length} mes(es).`, detail: `Meses: ${diffTot.map(mShort).join(", ")}.` });
    if (!out.length) out.push({ chip: "fact", title: "Sin observaciones: todas las sumas cuadran." });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, items, todayKey]);

  const dc = (d: number) => (Math.abs(d) < 5 ? "ok" : "bad");
  const dt = (d: number) => (Math.abs(d) < 5 ? "Cuadra" : (d > 0 ? "+" : "") + mm(d));

  return (
    <section>
      <h2>Doble revisión</h2>
      <p className="h2sub">Compara la suma de todas las líneas de proyecto con las filas de totales del Excel. Cuando no calzan, las fórmulas de totales dejaron fuera algún proyecto.</p>
      <div className="tabs" role="tablist">
        <button type="button" className="tab" role="tab" aria-selected={tab === "mes"} onClick={() => setTab("mes")}>Totales por mes</button>
        <button type="button" className="tab" role="tab" aria-selected={tab === "obs"} onClick={() => setTab("obs")}>Observaciones ({notes.length})</button>
      </div>
      {tab === "mes" ? (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Mes</th><th>Suma de líneas</th><th>Fila {R.real} REAL</th><th>Diferencia</th><th>Fila {R.total} TOTAL</th><th>Diferencia</th><th>Fila {R.proy} PROYECTADO</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const s = total(k), e = data.excel[k];
                const d1 = (e?.real ?? 0) - s, d2 = (e?.total ?? 0) - s;
                return (
                  <tr key={k} className={k === sel ? "cur" : ""}>
                    <td>{mName(k)}</td>
                    <td className="num">{clp(s)}</td>
                    <td className="num">{clp(e?.real ?? 0)}</td>
                    <td className={`num ${dc(d1)}`}>{dt(d1)}</td>
                    <td className="num">{clp(e?.total ?? 0)}</td>
                    <td className={`num ${dc(d2)}`}>{dt(d2)}</td>
                    <td className="num">{clp(e?.proy ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="notes">
          {notes.map((n, i) => (
            <div className="note" key={i}>
              <span className={`chip ${n.chip}`}><i />{n.chip === "bad" ? "Corregir" : "Revisar"}</span>
              <div>
                <p>{n.title}</p>
                {n.detail && <p className="small">{n.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
