"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Estado, RetrofitData, RetrofitDeal } from "@/lib/retrofit";
import { STAGE_EARLY } from "@/lib/retrofit";
import TopNav from "./TopNav";
import { HBars, SeriesChart, fmtCompact, fmtNum, fmtPct, labelYm } from "./RctCharts";
import "../app/dashboard.css";
import "../app/rct/rct.css";

const C_ADJ = "#16a34a";
const C_PERD = "#dc2626";
const C_ENV = "#2563eb";

type Moneda = "CLP" | "UF";
type Vista = "adj" | "perd" | "env" | "early" | "todos";

const ESTADO_LABEL: Record<Estado, string> = { adj: "Adjudicado", perd: "Perdido", env: "Enviada", early: "En etapa previa" };
const ESTADO_KIND: Record<Estado, string> = { adj: "good", perd: "critical", env: "info", early: "muted" };

const sum = (a: RetrofitDeal[]) => a.reduce((s, d) => s + d.clp, 0);

function fmtDate(v: string | null) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return `${d}-${m}-${y}`;
}

export default function RetrofitDashboard({ data, error }: { data: RetrofitData | null; error: string | null }) {
  const router = useRouter();
  const [moneda, setMoneda] = useState<Moneda>("CLP");
  const [vista, setVista] = useState<Vista>("adj");
  const [search, setSearch] = useState("");

  const deals = useMemo(() => data?.deals ?? [], [data]);
  const uf = data?.ufRate ?? 39000;

  const years = useMemo(() => {
    const ys = new Set<string>();
    deals.forEach((d) => {
      if ((d.estado === "adj" || d.estado === "perd") && d.fecha) ys.add(d.fecha.slice(0, 4));
    });
    return [...ys].sort().reverse();
  }, [deals]);

  const [year, setYear] = useState<string>(() => {
    const cur = String(new Date().getFullYear());
    return years.includes(cur) ? cur : (years[0] ?? "all");
  });

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const conv = (clp: number) => (moneda === "UF" ? clp / uf : clp);
  const money = (clp: number) => (moneda === "UF" ? `${fmtNum(clp / uf)} UF` : fmtCompact(clp));
  const moneyFromUnit = (v: number) => (moneda === "UF" ? `${fmtNum(v)} UF` : fmtCompact(v));

  const inYear = (d: RetrofitDeal) => year === "all" || (d.fecha?.startsWith(year) ?? false);

  const adj = useMemo(() => deals.filter((d) => d.estado === "adj" && inYear(d)), [deals, year]); // eslint-disable-line react-hooks/exhaustive-deps
  const perd = useMemo(() => deals.filter((d) => d.estado === "perd" && inYear(d)), [deals, year]); // eslint-disable-line react-hooks/exhaustive-deps
  const env = useMemo(() => deals.filter((d) => d.estado === "env"), [deals]);
  const early = useMemo(() => deals.filter((d) => d.estado === "early"), [deals]);

  const k = useMemo(() => {
    const cerrados = adj.length + perd.length;
    return {
      sumAdj: sum(adj),
      sumPerd: sum(perd),
      sumEnv: sum(env),
      tasa: cerrados ? adj.length / cerrados : null,
      ticket: adj.length ? sum(adj) / adj.length : 0,
    };
  }, [adj, perd, env]);

  const timeline = useMemo(() => {
    const keys = new Set<string>();
    [...adj, ...perd].forEach((d) => d.fecha && keys.add(d.fecha.slice(0, 7)));
    let months = [...keys].sort();
    if (year !== "all") months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    const by = (arr: RetrofitDeal[]) => {
      const m = new Map<string, number>();
      arr.forEach((d) => d.fecha && m.set(d.fecha.slice(0, 7), (m.get(d.fecha.slice(0, 7)) ?? 0) + d.clp));
      return months.map((x) => conv(m.get(x) ?? 0));
    };
    return { months, adj: by(adj), perd: by(perd) };
  }, [adj, perd, year, moneda, uf]); // eslint-disable-line react-hooks/exhaustive-deps

  const porCliente = useMemo(() => {
    const m = new Map<string, number>();
    adj.forEach((d) => m.set(d.cliente, (m.get(d.cliente) ?? 0) + d.clp));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, v]) => ({ label, value: conv(v) }));
  }, [adj, moneda, uf]); // eslint-disable-line react-hooks/exhaustive-deps

  const ejecutivos = useMemo(() => {
    const names = [...new Set([...adj, ...perd, ...env].map((d) => d.owner))];
    return names
      .map((owner) => {
        const a = adj.filter((d) => d.owner === owner);
        const p = perd.filter((d) => d.owner === owner);
        const e = env.filter((d) => d.owner === owner);
        const cerr = a.length + p.length;
        return { owner, a, p, e, tasa: cerr ? a.length / cerr : null };
      })
      .sort((x, y) => sum(y.a) - sum(x.a));
  }, [adj, perd, env]);

  const causas = useMemo(() => {
    const m = new Map<string, number>();
    perd.forEach((d) => m.set(d.causa ?? "Sin razón registrada", (m.get(d.causa ?? "Sin razón registrada") ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [perd]);

  const funnel = useMemo(() => {
    const cerrados = [...adj, ...perd];
    return {
      reunion: cerrados.filter((d) => d.tieneReunion).length,
      carta: cerrados.filter((d) => d.tieneCarta).length,
      total: cerrados.length,
    };
  }, [adj, perd]);

  const tabla = useMemo(() => {
    const base =
      vista === "adj" ? adj : vista === "perd" ? perd : vista === "env" ? env : vista === "early" ? early : [...adj, ...perd, ...env, ...early];
    const q = search.trim().toLowerCase();
    return base
      .filter((d) => !q || d.title.toLowerCase().includes(q) || d.cliente.toLowerCase().includes(q) || d.owner.toLowerCase().includes(q))
      .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
  }, [vista, adj, perd, env, early, search]);

  if (error || !data) {
    return (
      <div className="viz-root">
        <div className="wrap">
          <TopNav active="retrofit" />
          <header className="page-head">
            <h1>Retrofit — Pipedrive</h1>
            <p className="sub">No se pudieron cargar los datos</p>
          </header>
          <div className="error-box" style={{ marginTop: 20 }}>
            <strong>Error:</strong> {error ?? "Sin datos"}
          </div>
        </div>
      </div>
    );
  }

  const maxConv = Math.max(funnel.total, 1);
  const yearLabel = year === "all" ? "todos los años" : year;

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="retrofit" />
        <header className="page-head">
          <h1>Retrofit — Pipeline de ventas</h1>
          <p className="sub">Adjudicado, perdido y cartera del pipeline Retrofit en Pipedrive</p>
          <div className="meta">
            <span>Fuente: <strong style={{ color: "var(--text-secondary)" }}>Pipedrive</strong> (API en vivo, cache de 5 min)</span>
            <span className="dot" />
            <span>UF de hoy: <strong style={{ color: "var(--text-secondary)" }}>${fmtNum(uf, 2)}</strong></span>
            <span className="dot" />
            <span>última lectura {new Date(data.generatedAt).toLocaleString("es-CL")}</span>
            <span className="dot" />
            <button type="button" onClick={logout} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0 }}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <div className="rct-filters">
          <label>
            Año de cierre
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => (<option key={y} value={y}>{y}</option>))}
              <option value="all">Todos</option>
            </select>
          </label>
          <div className="seg">
            Moneda
            <div>
              <button type="button" className={moneda === "CLP" ? "on" : ""} onClick={() => setMoneda("CLP")}>CLP</button>
              <button type="button" className={moneda === "UF" ? "on" : ""} onClick={() => setMoneda("UF")}>UF</button>
            </div>
          </div>
        </div>

        <div className="stats">
          <div className="stat-tile"><div className="v" style={{ color: "var(--status-good)" }}>{money(k.sumAdj)}</div><div className="l">Adjudicado {yearLabel} · {adj.length} negocios</div></div>
          <div className="stat-tile"><div className="v" style={{ color: "var(--status-critical)" }}>{money(k.sumPerd)}</div><div className="l">Perdido {yearLabel} · {perd.length} negocios</div></div>
          <div className="stat-tile"><div className="v">{fmtPct(k.tasa)}</div><div className="l">Tasa de adjudicación (adj. / adj.+perd.)</div></div>
          <div className="stat-tile"><div className="v">{money(k.ticket)}</div><div className="l">Ticket promedio adjudicado</div></div>
          <div className="stat-tile"><div className="v" style={{ color: "var(--accent)" }}>{money(k.sumEnv)}</div><div className="l">Cartera enviada vigente · {env.length} negocios</div></div>
        </div>

        <section className="summary">
          <h2>Adjudicado vs perdido por mes</h2>
          <p className="hint">Monto por mes de cierre ({moneda}). Fecha de adjudicación según el campo del negocio; si falta, la fecha en que cambió de etapa.</p>
          <SeriesChart
            labels={timeline.months.map(labelYm)}
            series={[
              { name: "Adjudicado", kind: "bar", values: timeline.adj, color: C_ADJ },
              { name: "Perdido", kind: "bar", values: timeline.perd, color: C_PERD },
            ]}
            format={moneyFromUnit}
          />
        </section>

        <div className="rct-grid">
          <section className="summary" style={{ margin: 0 }}>
            <h2>Embudo actual</h2>
            <p className="hint">Negocios abiertos por etapa (foto de hoy, sin filtro de año).</p>
            {STAGE_EARLY.map((s) => {
              const arr = early.filter((d) => d.stageId === s.id);
              return (
                <div className="bar-row" key={s.id} style={{ gridTemplateColumns: "120px 1fr 120px" }}>
                  <div className="lbl">{s.label}</div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(arr.length / Math.max(early.length + env.length, 1)) * 100}%`, background: "#64748b" }} /></div>
                  <div className="n">{arr.length} · {money(sum(arr))}</div>
                </div>
              );
            })}
            <div className="bar-row" style={{ gridTemplateColumns: "120px 1fr 120px" }}>
              <div className="lbl">Enviada</div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(env.length / Math.max(early.length + env.length, 1)) * 100}%`, background: C_ENV }} /></div>
              <div className="n">{env.length} · {money(k.sumEnv)}</div>
            </div>
          </section>

          <section className="summary" style={{ margin: 0 }}>
            <h2>Conversión de los negocios cerrados</h2>
            <p className="hint">De los {funnel.total} negocios cerrados en {yearLabel}, cuántos pasaron por cada hito.</p>
            {[
              { l: "Cerrados", n: funnel.total, c: "#64748b" },
              { l: "Reunión con cliente", n: funnel.reunion, c: "#7c3aed" },
              { l: "Carta oferta", n: funnel.carta, c: "#d97706" },
              { l: "Adjudicados", n: adj.length, c: C_ADJ },
            ].map((r) => (
              <div className="bar-row" key={r.l} style={{ gridTemplateColumns: "140px 1fr 60px" }}>
                <div className="lbl">{r.l}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.n / maxConv) * 100}%`, background: r.c }} /></div>
                <div className="n">{r.n}</div>
              </div>
            ))}
            <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
              Adjudicados / carta oferta: {fmtPct(funnel.carta ? adj.length / funnel.carta : null)} · Adjudicados / reunión: {fmtPct(funnel.reunion ? adj.length / funnel.reunion : null)}
            </p>
          </section>
        </div>

        <div className="rct-grid">
          <section className="summary" style={{ margin: 0 }}>
            <h2>Top clientes adjudicados</h2>
            <p className="hint">Monto adjudicado en {yearLabel} ({moneda}).</p>
            <HBars items={porCliente} format={moneyFromUnit} color={C_ADJ} />
          </section>

          <section className="summary" style={{ margin: 0 }}>
            <h2>Motivos de pérdida</h2>
            <p className="hint">Campo “causa de rechazo” de los negocios perdidos en {yearLabel}.</p>
            {causas.length === 0 && <div className="rct-empty">Sin negocios perdidos</div>}
            {causas.map(([label, n]) => (
              <div className="bar-row" key={label} style={{ gridTemplateColumns: "180px 1fr 70px" }}>
                <div className="lbl" title={label}>{label}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(n / causas[0][1]) * 100}%`, background: C_PERD }} /></div>
                <div className="n">{n} · {Math.round((n / perd.length) * 100)}%</div>
              </div>
            ))}
          </section>
        </div>

        <section className="summary">
          <h2>Por ejecutivo</h2>
          <p className="hint">Adjudicado y perdido en {yearLabel}; cartera enviada vigente.</p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Ejecutivo</th><th>Adjudicado</th><th>N° adj.</th><th>Perdido</th><th>N° perd.</th><th>Tasa</th><th>Cartera enviada</th></tr>
              </thead>
              <tbody>
                {ejecutivos.map((e) => (
                  <tr key={e.owner}>
                    <td className="obra-col">{e.owner}</td>
                    <td>{money(sum(e.a))}</td>
                    <td>{e.a.length}</td>
                    <td>{money(sum(e.p))}</td>
                    <td>{e.p.length}</td>
                    <td>{fmtPct(e.tasa)}</td>
                    <td>{money(sum(e.e))} ({e.e.length})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="summary">
          <h2>Detalle de negocios</h2>
          <div className="rct-tabs" role="tablist" style={{ marginTop: 10 }}>
            {([
              ["adj", `Adjudicados (${adj.length})`],
              ["perd", `Perdidos (${perd.length})`],
              ["env", `Enviadas (${env.length})`],
              ["early", `Etapas previas (${early.length})`],
              ["todos", "Todos"],
            ] as [Vista, string][]).map(([id, label]) => (
              <button key={id} type="button" role="tab" className={vista === id ? "active" : ""} onClick={() => setVista(id)}>{label}</button>
            ))}
          </div>
          <input className="search-box" type="text" placeholder="Buscar negocio, cliente o ejecutivo…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Negocio</th><th>Cliente</th><th>Ejecutivo</th><th>Monto</th><th>Fecha</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {tabla.map((d) => (
                  <tr key={d.id}>
                    <td className="obra-col"><a href={d.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{d.title}</a></td>
                    <td>{d.cliente}</td>
                    <td>{d.owner}</td>
                    <td>{d.currency === "CLF" ? `${fmtNum(d.rawValue)} UF` : fmtCompact(d.rawValue)}</td>
                    <td>{fmtDate(d.fecha)}</td>
                    <td><span className={`status-chip ${ESTADO_KIND[d.estado]}`}>{ESTADO_LABEL[d.estado]}</span></td>
                  </tr>
                ))}
                {tabla.length === 0 && <tr><td colSpan={6} className="wrap-col">Sin negocios para este filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="note">
          <strong>Sobre esta página:</strong> lee el pipeline RETROFIT de Pipedrive en cada visita (cache de 5 minutos). Los montos en UF se
          convierten a CLP con la UF del día. “Adjudicado” y “Perdido” se ubican por la fecha del campo personalizado del negocio y, si falta,
          por la fecha de cambio de etapa; el filtro de año aplica a esos dos grupos. Cuando se cree una etapa nueva (p. ej. “Adjudicada 2027”),
          hay que agregar su id en <code>lib/retrofit.ts</code>.
        </footer>
      </div>
    </div>
  );
}
