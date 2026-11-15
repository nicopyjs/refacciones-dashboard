"use client";

import { useMemo, useState } from "react";
import type { CostoRealData, CostoResumenMes } from "@/lib/parseCostoReal";

const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mName = (k: string) => { const [y, m] = k.split("-"); return `${MES[+m - 1]} ${y}`; };
const mShort = (k: string) => { const [y, m] = k.split("-"); return `${MES3[+m - 1]} ${y.slice(2)}`; };
const clp = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("es-CL");
const mm = (n: number) => {
  const a = Math.abs(n), neg = n < 0 ? "-" : "";
  if (a >= 1e6) return neg + "$" + (a / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " M";
  if (a >= 1e3) return neg + "$" + Math.round(a / 1e3).toLocaleString("es-CL") + " mil";
  return clp(n);
};
const sign = (n: number) => (n > 0.5 ? "pos" : n < -0.5 ? "neg" : "");
const pctTxt = (u: number, f: number) => (f ? `${(Math.round((u / f) * 1000) / 10).toLocaleString("es-CL")}%` : "·");
const qOf = (k: string) => { const [y, m] = k.split("-"); return `${y}-Q${Math.ceil(+m / 3)}`; };
const qName = (q: string) => { const [y, n] = q.split("-"); return `${n} ${y}`; }; // "Q4 2026"
const qMonths = (q: string) => { const [y, n] = q.split("-Q"); return [0, 1, 2].map((i) => `${y}-${String((+n - 1) * 3 + 1 + i).padStart(2, "0")}`); };

type Row = { k: string; r: CostoResumenMes | null; accQ: number; accAll: number };
type Quarter = { q: string; rows: Row[]; fact: number; costo: number; util: number; withData: number };

export default function UtilidadView({ data, todayKey, generatedAt }: { data: CostoRealData; todayKey: string; generatedAt: string }) {
  // Meses con datos en el resumen + trimestres completos que tocan esos meses o columnas de la hoja (2026 en adelante).
  const { quarters, keys } = useMemo(() => {
    const dataKeys = Object.keys(data.resumen).sort();
    const sheetKeys = data.months.filter((k) => k >= "2026-01");
    const qs = Array.from(new Set([...dataKeys, ...sheetKeys].map(qOf))).sort();
    let accAll = 0;
    const quarters: Quarter[] = qs.map((q) => {
      let accQ = 0, fact = 0, costo = 0, withData = 0;
      const rows: Row[] = qMonths(q).map((k) => {
        const r = data.resumen[k] ?? null;
        if (r) { accQ += r.utilidad; accAll += r.utilidad; fact += r.facturacion; costo += r.costoTotal; withData++; }
        return { k, r, accQ, accAll };
      });
      return { q, rows, fact, costo, util: fact - costo, withData };
    });
    return { quarters, keys: dataKeys };
  }, [data]);

  const [selRaw, setSel] = useState(todayKey);
  const sel = keys.includes(selRaw) ? selRaw : keys.includes(todayKey) ? todayKey : keys[keys.length - 1];

  if (!keys.length) {
    return (
      <div className="source">
        <span className="dot err" />
        <span>No se encontró el resumen (Facturación, Costo Total, Utilidad) al final de la pestaña Costo real.</span>
      </div>
    );
  }

  const r = data.resumen[sel];
  const idx = keys.indexOf(sel);
  const qSel = quarters.find((x) => x.q === qOf(sel))!;
  const rowSel = qSel.rows.find((x) => x.k === sel)!;
  const isCur = sel === todayKey, isPast = sel < todayKey;

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
          <div className="label">Utilidad {mName(sel)}</div>
          <div className={`hero num ${sign(r.utilidad)}`}>{mm(r.utilidad)}</div>
          <div className="sub">
            Facturación {mm(r.facturacion)} − costo total {mm(r.costoTotal)} · margen {pctTxt(r.utilidad, r.facturacion)} · {isCur ? "mes en curso" : isPast ? "mes cerrado" : "mes futuro"}
          </div>
        </div>
        <div className="kpis">
          <div className="kpi"><span className="chip fact"><i />Se debe facturar</span><div className="v num">{mm(r.facturacion)}</div><div className="who">fila Facturación</div></div>
          <div className="kpi"><span className="chip pag"><i />Costo total</span><div className="v num">{mm(r.costoTotal)}</div><div className="who">directo {mm(r.costoDirecto)} + indirecto {mm(r.indirectoTotal)}</div></div>
          <div className="kpi"><span className="chip proy"><i />Margen</span><div className={`v num ${sign(r.utilidad)}`}>{pctTxt(r.utilidad, r.facturacion)}</div><div className="who">utilidad / facturación</div></div>
        </div>
      </div>
      <div className="kpis conc">
        <div className="kpi"><span className="chip proy"><i />Acumulada {qName(qSel.q)} (hasta {mShort(sel)})</span><div className={`v num ${sign(rowSel.accQ)}`}>{mm(rowSel.accQ)}</div><div className="who">se reinicia cada trimestre</div></div>
        <div className="kpi"><span className="chip proy"><i />Total {qName(qSel.q)}</span><div className={`v num ${sign(qSel.util)}`}>{qSel.withData ? mm(qSel.util) : "·"}</div><div className="who">{qSel.withData} de 3 meses con datos</div></div>
        <div className="kpi"><span className="chip proy"><i />Acumulada total (hasta {mShort(sel)})</span><div className={`v num ${sign(rowSel.accAll)}`}>{mm(rowSel.accAll)}</div><div className="who">suma desde {mShort(keys[0])}</div></div>
      </div>

      <section>
        <h2>Utilidad por mes</h2>
        <p className="h2sub">Facturación menos costo total de cada mes. Verde = utilidad, rojo = pérdida. La franja amarilla marca el mes seleccionado.</p>
        <div className="panel">
          <div className="legend">
            <span><i className="s-fact" />Utilidad</span>
            <span><i style={{ background: "var(--bad)" }} />Pérdida</span>
          </div>
          <Chart keys={keys} data={data} sel={sel} onSelect={setSel} />
        </div>
      </section>

      <section>
        <h2>Utilidad proyectada por trimestre</h2>
        <p className="h2sub">Mes a mes con la utilidad acumulada dentro del trimestre y el total de cada uno (Q4 = oct + nov + dic, Q1 = ene + feb + mar).</p>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Mes</th><th>Facturación</th><th>Costo directo</th><th>Costo total indirecto</th><th>Costo total</th><th>Utilidad</th><th>Acum. trimestre</th><th>Acum. total</th></tr>
            </thead>
            <tbody>
              {quarters.map((q) => (
                <QuarterRows key={q.q} q={q} todayKey={todayKey} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Resumen de trimestres</h2>
        <p className="h2sub">Total de cada trimestre: facturación − costo total.</p>
        <div className="scroll">
          <table>
            <thead><tr><th>Trimestre</th><th>Meses</th><th>Facturación</th><th>Costo total</th><th>Utilidad</th><th>Margen</th></tr></thead>
            <tbody>
              {quarters.map((q) => (
                <tr key={q.q}>
                  <td>{qName(q.q)}</td>
                  <td>{q.withData === 3 ? "completo" : q.withData ? `${q.withData} de 3 (parcial)` : "sin datos aún en la hoja"}</td>
                  <td className="num">{q.withData ? mm(q.fact) : "·"}</td>
                  <td className="num">{q.withData ? mm(q.costo) : "·"}</td>
                  <td className={`num ${q.withData ? sign(q.util) : ""}`}>{q.withData ? mm(q.util) : "·"}</td>
                  <td className="num">{q.withData ? pctTxt(q.util, q.fact) : "·"}</td>
                </tr>
              ))}
              <tr className="tot">
                <td>Total</td>
                <td />
                <td className="num">{mm(quarters.reduce((s, q) => s + q.fact, 0))}</td>
                <td className="num">{mm(quarters.reduce((s, q) => s + q.costo, 0))}</td>
                <td className="num">{mm(quarters.reduce((s, q) => s + q.util, 0))}</td>
                <td className="num">{pctTxt(quarters.reduce((s, q) => s + q.util, 0), quarters.reduce((s, q) => s + q.fact, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        Fuente: pestaña &quot;Costo real&quot; de PROYECCION REFACCION.xlsx (Google Drive), filas Facturación, Costo sin Mano de obra y Costo Total indirecto. Costo total = directo + indirecto. Utilidad = facturación − costo total (fila Utilidad de la hoja). El acumulado por trimestre se calcula aquí para todos los meses, también los que la hoja deja vacíos.
      </footer>
    </>
  );
}

function QuarterRows({ q, todayKey }: { q: Quarter; todayKey: string }) {
  return (
    <>
      <tr className="qhead"><td colSpan={8}>{qName(q.q)}{q.withData < 3 ? (q.withData ? ` · parcial (${q.withData} de 3 meses)` : " · sin datos aún en la hoja") : ""}</td></tr>
      {q.rows.map(({ k, r, accQ, accAll }) => (
        <tr key={k}>
          <td className={k === todayKey ? "cur" : ""}>{mName(k)}</td>
          {r ? (
            <>
              <td className="num">{mm(r.facturacion)}</td>
              <td className="num">{mm(r.costoDirecto)}</td>
              <td className="num">{mm(r.indirectoTotal)}</td>
              <td className="num">{mm(r.costoTotal)}</td>
              <td className={`num ${sign(r.utilidad)}`}>{mm(r.utilidad)}</td>
              <td className={`num ${sign(accQ)}`}>{mm(accQ)}</td>
              <td className={`num ${sign(accAll)}`}>{mm(accAll)}</td>
            </>
          ) : (
            <td colSpan={7} style={{ color: "var(--muted)" }}>sin datos en la hoja</td>
          )}
        </tr>
      ))}
      {q.withData > 0 && (
        <tr className="qtot">
          <td>Total {qName(q.q)}</td>
          <td className="num">{mm(q.fact)}</td>
          <td className="num">{mm(q.rows.reduce((s, x) => s + (x.r?.costoDirecto ?? 0), 0))}</td>
          <td className="num">{mm(q.rows.reduce((s, x) => s + (x.r?.indirectoTotal ?? 0), 0))}</td>
          <td className="num">{mm(q.costo)}</td>
          <td className={`num ${sign(q.util)}`}>{mm(q.util)}</td>
          <td className={`num ${sign(q.util)}`}>{mm(q.util)}</td>
          <td />
        </tr>
      )}
    </>
  );
}

function Chart({ keys, data, sel, onSelect }: { keys: string[]; data: CostoRealData; sel: string; onSelect: (k: string) => void }) {
  const [tip, setTip] = useState<{ k: string; x: number; y: number } | null>(null);
  const W = 1000, H = 340, L = 64, R = 12, T = 16, B = 40;
  const utils = keys.map((k) => data.resumen[k].utilidad);
  const hi = Math.max(0, ...utils), lo = Math.min(0, ...utils);
  const step = [5e6, 10e6, 20e6, 25e6, 50e6, 100e6].find((s) => (hi - lo) / s <= 7) || 100e6;
  const top = Math.ceil(hi / step) * step, bot = Math.floor(lo / step) * step;
  const y = (v: number) => T + (H - T - B) * (1 - (v - bot) / Math.max(1, top - bot));
  const bw = (W - L - R) / Math.max(1, keys.length);
  const ticks: number[] = [];
  for (let v = bot; v <= top; v += step) ticks.push(v);
  const tr = tip ? data.resumen[tip.k] : null;

  return (
    <div className="chartbox">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Utilidad mensual proyectada">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--ink-2)" : "var(--grid)"} strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{v ? v / 1e6 + " M" : "0"}</text>
          </g>
        ))}
        {keys.map((k, i) => {
          const u = data.resumen[k].utilidad, x = L + i * bw, w = Math.max(6, bw * 0.62), cx = x + (bw - w) / 2;
          const y0 = y(0), y1 = y(u);
          return (
            <g key={k}>
              {k === sel && <rect x={x + 1} y={T - 6} width={bw - 2} height={H - T - B + 6} fill="var(--brand)" opacity={0.16} rx={4} />}
              <rect x={cx} y={Math.min(y0, y1)} width={w} height={Math.abs(y0 - y1)} fill={u >= 0 ? "var(--fact)" : "var(--bad)"} rx={3} />
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
      {tip && tr && (
        <div className="tip" style={{ left: tip.x, top: tip.y }}>
          <b>{mName(tip.k)}</b>
          {([["Facturación", tr.facturacion], ["Costo total", tr.costoTotal], ["Utilidad", tr.utilidad]] as const).map(([n, v]) => (
            <div className="l num" key={n}><span>{n}</span><span>{clp(v)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
