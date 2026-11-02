"use client";

import { useMemo, useState } from "react";
import { COSTO_CATEGORIES, type CostoItem, type CostoRealData, type CostoStatus } from "@/lib/parseCostoReal";

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
const STATUS_LABEL: Record<CostoStatus, string> = { pag: "pagado", proy: "proyectado" };

type Item = CostoItem & { code: string; name: string };
type Agg = { pag: number; proy: number };

export default function CostoRealView({ data, todayKey, generatedAt }: { data: CostoRealData; todayKey: string; generatedAt: string }) {
  const keys = useMemo(() => {
    const used = new Set(data.projects.flatMap((p) => p.items.map((i) => i.month)));
    return data.months.filter((k) => k >= "2025-01" && used.has(k));
  }, [data]);
  const [selRaw, setSel] = useState(todayKey);
  const sel = keys.includes(selRaw) ? selRaw : keys.includes(todayKey) ? todayKey : keys[keys.length - 1];

  const items: Item[] = useMemo(
    () => data.projects.flatMap((p) => p.items.map((i) => ({ ...i, code: p.code, name: p.name }))),
    [data]
  );
  const agg = useMemo(() => {
    const a: Record<string, Agg> = {};
    for (const k of data.months) a[k] = { pag: 0, proy: 0 };
    for (const i of items) a[i.month][i.status] += i.amount;
    return a;
  }, [data, items]);

  const a = agg[sel] ?? { pag: 0, proy: 0 };
  const tot = a.pag + a.proy;
  const pct = tot ? Math.round((a.pag / tot) * 100) : 0;
  const isCur = sel === todayKey, isPast = sel < todayKey;
  const mItems = items.filter((i) => i.month === sel);
  const idx = keys.indexOf(sel);

  const byCat = COSTO_CATEGORIES.map((c) => {
    const its = mItems.filter((i) => i.category === c);
    return {
      c,
      pag: its.filter((i) => i.status === "pag").reduce((s, i) => s + i.amount, 0),
      proy: its.filter((i) => i.status === "proy").reduce((s, i) => s + i.amount, 0),
    };
  });

  const top = mItems.reduce<Record<string, { name: string; code: string; pag: number; proy: number }>>((g, i) => {
    const e = (g[`${i.code}|${i.name}`] ??= { name: i.name, code: i.code, pag: 0, proy: 0 });
    e[i.status] += i.amount;
    return g;
  }, {});
  const topList = Object.values(top).sort((x, y) => y.pag + y.proy - (x.pag + x.proy));

  return (
    <>
      <div className="controls" style={{ justifyContent: "space-between", paddingBlock: "10px 0" }}>
        <div className="source" style={{ padding: 0 }}>
          <span className="dot live" />
          <span>En vivo desde Google Drive · Costo real · leído {new Date(generatedAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
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
          <div className="label">Costo total {mName(sel)}</div>
          <div className="hero num">{mm(tot)}</div>
          <div className="sub">
            {tot ? `${pct}% ya pagado · ${isCur ? "mes en curso" : isPast ? "mes cerrado" : "mes futuro"}` : "Sin costos este mes"}
          </div>
          <div className="segbar" aria-hidden="true">
            {(["pag", "proy"] as const).map((s) => (
              <span key={s} className={s === "pag" ? "s-pag" : "s-cpr"} hidden={!a[s]} style={{ flexGrow: a[s], flexBasis: 0 }} />
            ))}
          </div>
        </div>
        <div className="kpis">
          <div className="kpi"><span className="chip pag"><i />Pagado</span><div className="v num">{mm(a.pag)}</div><div className="who">{mItems.filter((i) => i.status === "pag").length} ítems · letra naranja</div></div>
          <div className="kpi"><span className="chip cpr"><i />Proyectado</span><div className="v num">{mm(a.proy)}</div><div className="who">{mItems.filter((i) => i.status === "proy").length} ítems · letra morada</div></div>
        </div>
      </div>

      <section>
        <h2>Por tipo de costo</h2>
        <p className="h2sub">Cómo se reparte {mName(sel)} entre materiales, mano de obra, certificación y obras civiles.</p>
        <div className="scroll">
          <table>
            <thead><tr><th>Tipo</th><th>Pagado</th><th>Proyectado</th><th>Total</th></tr></thead>
            <tbody>
              {byCat.map((r) => (
                <tr key={r.c}>
                  <td>{r.c}</td>
                  <td className={`num ${r.pag ? "pag" : ""}`}>{r.pag ? mm(r.pag) : "·"}</td>
                  <td className={`num ${r.proy ? "cpr" : ""}`}>{r.proy ? mm(r.proy) : "·"}</td>
                  <td className="num">{r.pag + r.proy ? mm(r.pag + r.proy) : "·"}</td>
                </tr>
              ))}
              <tr className="tot"><td>Total</td><td className="num">{mm(a.pag)}</td><td className="num">{mm(a.proy)}</td><td className="num">{mm(tot)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Cómo vienen los meses</h2>
        <p className="h2sub">Costo mensual: naranjo lo ya pagado, morado lo proyectado. La franja amarilla marca el mes seleccionado.</p>
        <div className="panel">
          <div className="legend">
            <span><i className="s-pag" />Pagado</span>
            <span><i className="s-cpr" />Proyectado</span>
          </div>
          <Chart months={keys} agg={agg} sel={sel} onSelect={setSel} />
        </div>
      </section>

      <section>
        <h2>Proyectos del mes</h2>
        <p className="h2sub">Ordenados por costo en {mName(sel)}.</p>
        <div className="panel">
          <div className="list">
            {topList.length ? topList.map((p) => (
              <div className="row" key={p.code + p.name}>
                <div>
                  <div className="p">{p.name}</div>
                  <div className="c">{p.code || "sin código"} · pagado {p.pag ? clp(p.pag) : "$0"} · proyectado {p.proy ? clp(p.proy) : "$0"}</div>
                </div>
                <div className="a num">{clp(p.pag + p.proy)}</div>
              </div>
            )) : <div className="empty">Sin costos este mes.</div>}
          </div>
        </div>
      </section>

      <Matrix data={data} keys={keys} sel={sel} todayKey={todayKey} />
      <Presupuesto data={data} />

      <footer>
        Fuente: pestaña &quot;Costo real&quot; de PROYECCION REFACCION.xlsx (Google Drive). Letra naranja = costo ya pagado, letra morada = costo futuro o proyectado. Los montos de 2025 con letra negra se cuentan como pagados.
      </footer>
    </>
  );
}

function Chart({ months, agg, sel, onSelect }: { months: string[]; agg: Record<string, Agg>; sel: string; onSelect: (k: string) => void }) {
  const [tip, setTip] = useState<{ k: string; x: number; y: number } | null>(null);
  const keys = months.filter((k) => k >= "2025-01");
  const W = 1000, H = 340, L = 64, R = 12, T = 16, B = 40;
  const max = Math.max(1, ...keys.map((k) => agg[k].pag + agg[k].proy));
  const step = [10e6, 20e6, 25e6, 50e6, 100e6].find((s) => max / s <= 6) || 50e6;
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const bw = (W - L - R) / Math.max(1, keys.length);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const tipAgg = tip ? agg[tip.k] : null;

  return (
    <div className="chartbox">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Costo mensual apilado por estado">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{v ? v / 1e6 + " M" : "0"}</text>
          </g>
        ))}
        {keys.map((k, idx) => {
          const ag = agg[k], x = L + idx * bw, w = Math.max(6, bw * 0.62), cx = x + (bw - w) / 2;
          let base = 0;
          const segs = ([["pag", "var(--pag)"], ["proy", "var(--cpr)"]] as const).filter(([s]) => ag[s] > 0);
          return (
            <g key={k}>
              {k === sel && <rect x={x + 1} y={T - 6} width={bw - 2} height={H - T - B + 6} fill="var(--brand)" opacity={0.16} rx={4} />}
              {segs.map(([s, fill], j) => {
                const y0 = y(base), y1 = y(base + ag[s]);
                base += ag[s];
                const h = Math.max(0, y0 - y1 - (j < segs.length - 1 ? 2 : 0));
                return <rect key={s} x={cx} y={y0 - h} width={w} height={h} fill={fill} rx={j === segs.length - 1 ? 3 : 0} />;
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
          {([["Pagado", tipAgg.pag], ["Proyectado", tipAgg.proy], ["Total", tipAgg.pag + tipAgg.proy]] as const).map(([n, v]) => (
            <div className="l num" key={n}><span>{n}</span><span>{clp(v)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function Matrix({ data, keys: allKeys, sel, todayKey }: { data: CostoRealData; keys: string[]; sel: string; todayKey: string }) {
  const i0 = allKeys.indexOf(sel);
  const keys = allKeys.slice(i0, i0 + 6);
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
      <p className="h2sub">Seis meses desde el mes seleccionado. Naranjo pagado, morado proyectado.</p>
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
                  const cls = !c.v ? "" : c.st.size > 1 ? "cmix" : c.st.has("pag") ? "pag" : "cpr";
                  const title = c.v ? c.its.map((i) => `${i.category}: ${clp(i.amount)} (${STATUS_LABEL[i.status]})`).join("\n") : undefined;
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

function Presupuesto({ data }: { data: CostoRealData }) {
  const rows = data.projects
    .map((p) => {
      const pag = p.items.filter((i) => i.status === "pag").reduce((s, i) => s + i.amount, 0);
      const proy = p.items.filter((i) => i.status === "proy").reduce((s, i) => s + i.amount, 0);
      return { p, pag, proy, tot: pag + proy, saldo: p.budget != null ? p.budget - pag - proy : null };
    })
    .filter((r) => r.tot > 0 || r.p.budget)
    .sort((x, y) => y.tot - x.tot);
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);

  return (
    <section>
      <h2>Costo vs presupuesto</h2>
      <p className="h2sub">Costo total del proyecto (pagado + proyectado) contra el costo presupuestado de la hoja Costos. Saldo negativo = se pasa del presupuesto.</p>
      <div className="scroll">
        <table>
          <thead>
            <tr><th>Proyecto</th><th>Presupuesto</th><th>Pagado</th><th>Proyectado</th><th>Costo total</th><th>Saldo</th><th>Avance pagado</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const base = r.p.budget || r.tot || 1;
              return (
                <tr key={r.p.row}>
                  <td><div className="pn">{r.p.name}</div><div className="pc">{r.p.code || "sin código"}</div></td>
                  <td className="num">{r.p.budget != null ? mm(r.p.budget) : "·"}</td>
                  <td className="num">{mm(r.pag)}</td>
                  <td className="num">{mm(r.proy)}</td>
                  <td className="num">{mm(r.tot)}</td>
                  <td className={`num ${r.saldo != null && r.saldo < -5 ? "bad" : ""}`}>{r.saldo != null ? mm(r.saldo) : "·"}</td>
                  <td>
                    <div className="bar" aria-label={`${Math.round((r.pag / base) * 100)}% pagado`}>
                      <span className="s-pag" style={{ width: `${Math.min(100, (r.pag / base) * 100)}%` }} />
                      <span className="s-cpr" style={{ width: `${Math.max(0, Math.min(100 - (r.pag / base) * 100, (r.proy / base) * 100))}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr className="tot">
              <td>Total ({rows.length} proyectos)</td>
              <td className="num">{mm(sum((r) => r.p.budget ?? 0))}</td>
              <td className="num">{mm(sum((r) => r.pag))}</td>
              <td className="num">{mm(sum((r) => r.proy))}</td>
              <td className="num">{mm(sum((r) => r.tot))}</td>
              <td className="num">{mm(sum((r) => r.saldo ?? 0))}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
