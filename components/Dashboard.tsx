"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import type { Week } from "@/lib/parseSchedule";
import type { Comment } from "@/lib/comments";
import CommentsPanel from "./CommentsPanel";
import TopNav from "./TopNav";
import "../app/dashboard.css";

const MONTH_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function PersonCell({ person, specialty }: { person: string; specialty?: string }) {
  return (
    <>
      <div className="person-name">{titleCase(person)}</div>
      {specialty && <div className="person-specialty">{specialty}</div>}
    </>
  );
}

function textColorFor(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#141414" : "#ffffff";
}

function cellLabel(task: string | null, site: string | null): string {
  if (!task) return "";
  if (site && task.toUpperCase() !== site.toUpperCase()) return `${task} - ${site}`;
  return task;
}

interface MonthDay {
  date: string;
  weekday: string;
}
interface MonthCell {
  task: string | null;
  site: string | null;
}
interface MonthPerson {
  person: string;
  cells: MonthCell[];
}
interface MonthGroup {
  key: string;
  label: string;
  days: MonthDay[];
  people: MonthPerson[];
}

function groupByMonth(weeks: Week[]): MonthGroup[] {
  const months = new Map<
    string,
    { dateSet: Map<string, string>; people: Map<string, Map<string, MonthCell>> }
  >();

  weeks.forEach((week) => {
    week.dates.forEach((date, di) => {
      if (!date) return;
      const key = date.slice(0, 7);
      if (!months.has(key)) months.set(key, { dateSet: new Map(), people: new Map() });
      const m = months.get(key)!;
      m.dateSet.set(date, week.weekdays[di]);
      week.people.forEach((p) => {
        if (!m.people.has(p.person)) m.people.set(p.person, new Map());
        m.people.get(p.person)!.set(date, { task: p.tasks[di], site: p.sites[di] });
      });
    });
  });

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, m]) => {
      const dates = [...m.dateSet.keys()].sort();
      const days: MonthDay[] = dates.map((d) => ({ date: d, weekday: m.dateSet.get(d)! }));
      const people: MonthPerson[] = [...m.people.entries()].map(([person, dayMap]) => ({
        person,
        cells: dates.map((d) => dayMap.get(d) ?? { task: null, site: null }),
      }));
      const [y, mo] = key.split("-").map(Number);
      return { key, label: `${MONTH_ES[mo - 1]} ${y}`, days, people };
    });
}

export default function Dashboard({
  weeks,
  siteColors,
  specialties,
  generatedAt,
  error,
}: {
  weeks: Week[];
  siteColors: Record<string, string>;
  specialties: Record<string, string>;
  generatedAt: string;
  error: string | null;
}) {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setToday(`${d.getFullYear()}-${mm}-${dd}`);
  }, []);

  useEffect(() => {
    fetch("/api/comments")
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setComments([]));
  }, []);

  const commentsByDate = useMemo(() => {
    const map: Record<string, Comment[]> = {};
    comments.forEach((c) => {
      (map[c.date] ??= []).push(c);
    });
    return map;
  }, [comments]);

  const handleAddComment = useCallback(async (date: string, site: string | null, author: string, text: string) => {
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, site, author, text }),
    });
    if (res.ok) {
      const { comment } = await res.json();
      setComments((prev) => [...prev, comment]);
    }
  }, []);

  const handleDeleteComment = useCallback(async (date: string, id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/comments?date=${encodeURIComponent(date)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }, []);

  const peopleList = useMemo(() => {
    const seen: string[] = [];
    weeks.forEach((w) => w.people.forEach((p) => { if (!seen.includes(p.person)) seen.push(p.person); }));
    return seen;
  }, [weeks]);

  const siteNames = useMemo(() => Object.keys(siteColors), [siteColors]);

  const siteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    weeks.forEach((w) => w.people.forEach((p) => p.sites.forEach((s) => {
      if (!s) return;
      counts[s] = (counts[s] || 0) + 1;
    })));
    return counts;
  }, [weeks]);

  const totalShifts = useMemo(
    () => weeks.reduce((acc, w) => acc + w.people.reduce((a, p) => a + p.tasks.filter(Boolean).length, 0), 0),
    [weeks]
  );

  // a month with only one week's worth of days (or less) is redundant with the
  // weekly cards below and reads as broken (a handful of columns stretched wide)
  const months = useMemo(() => groupByMonth(weeks).filter((m) => m.days.length > 5), [weeks]);

  if (error) {
    return (
      <div className="viz-root">
        <div className="wrap">
          <TopNav active="calendario" />
          <header className="page-head">
            <h1>Calendario de Refacciones — RCT Operativo</h1>
            <p className="sub">No se pudieron cargar los datos</p>
          </header>
          <div className="error-box" style={{ marginTop: 20 }}>
            <strong>Error:</strong> {error}
          </div>
        </div>
      </div>
    );
  }

  const barEntries = Object.keys(siteCounts)
    .map((site) => ({ site, count: siteCounts[site], color: siteColors[site] || "#7f7f7f" }))
    .sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...barEntries.map((e) => e.count), 1);

  function renderLegendChip(site: string, count?: number) {
    const color = siteColors[site] || "#7f7f7f";
    const active = selectedSite === site;
    return (
      <button
        key={site}
        className={"site-chip-btn" + (active ? " active" : "")}
        style={{
          ["--chip-color" as string]: color,
          ["--chip-text" as string]: textColorFor(color),
        }}
        onClick={() => setSelectedSite(active ? null : site)}
      >
        {site}
        {count !== undefined && <span className="chip-count">{count}</span>}
      </button>
    );
  }

  function renderCell(task: string | null, site: string | null, dim: boolean) {
    if (!task && !site) return <span className="task-empty">—</span>;
    const color = site ? siteColors[site] : null;
    const label = task ? cellLabel(task, site) : site!;
    const style: React.CSSProperties = color
      ? { background: color, color: textColorFor(color) }
      : {};
    return (
      <span className={"task-pill-solid" + (dim ? " dim" : "") + (!color ? " neutral" : "")} style={style} title={label}>
        {label}
      </span>
    );
  }

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="calendario" />
        <header className="page-head">
          <h1>Calendario de Refacciones — RCT Operativo</h1>
          <p className="sub">Asignación diaria de tareas por colaborador y obra en curso</p>
          <div className="meta">
            <span>
              Fuente: <strong style={{ color: "var(--text-secondary)" }}>Calendario refacciones - JULIO.xlsx</strong> (Google Drive)
            </span>
            <span className="dot" />
            <span>Actualizado en cada visita · última lectura {new Date(generatedAt).toLocaleString("es-CL")}</span>
          </div>
        </header>

        <div className="stats">
          <div className="stat-tile"><div className="v">{peopleList.length}</div><div className="l">Colaboradores activos</div></div>
          <div className="stat-tile"><div className="v">{siteNames.length}</div><div className="l">Obras en curso</div></div>
          <div className="stat-tile"><div className="v">{weeks.length}</div><div className="l">Semanas planificadas</div></div>
          <div className="stat-tile"><div className="v">{totalShifts}</div><div className="l">Turnos asignados (persona-día)</div></div>
        </div>

        <div className="controls">
          <div className="controls-row">
            <span className="label">Colaborador</span>
            <div className="chip-row">
              {peopleList.map((p) => (
                <button
                  key={p}
                  className={"chip" + (selectedPerson === p ? " active" : "")}
                  onClick={() => setSelectedPerson(selectedPerson === p ? null : p)}
                >
                  {titleCase(p)}
                </button>
              ))}
            </div>
          </div>
          <div className="controls-row">
            <span className="label">Obra</span>
            <div className="chip-row">
              {siteNames.map((s) => renderLegendChip(s))}
              {selectedSite && (
                <button className="reset" onClick={() => setSelectedSite(null)}>Quitar filtro de obra</button>
              )}
            </div>
          </div>
        </div>

        {months.map((month) => (
          <section className="month-card" key={month.key}>
            <div className="week-head">
              <h2>Vista mensual — {month.label}</h2>
            </div>
            <div className="table-scroll">
              <table className="sched month-table">
                <thead>
                  <tr>
                    <th className="name-col">Colaborador</th>
                    {month.days.map((d) => {
                      const isToday = d.date === today;
                      const dayComments = commentsByDate[d.date] ?? [];
                      return (
                        <th key={d.date} className={"day-col" + (isToday ? " today-col" : "")}>
                          {d.weekday}
                          <span className="dnum">{d.date.slice(8, 10)}</span>
                          {dayComments.length > 0 && (
                            <span
                              className="comment-badge"
                              title={dayComments.map((c) => `${c.site ? `[${c.site}] ` : ""}${c.author}: ${c.text}`).join("\n")}
                            >
                              {dayComments.length}
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {month.people.map((p) => {
                    const matchesPerson = selectedPerson === null || selectedPerson === p.person;
                    const rowClass = selectedPerson !== null ? (matchesPerson ? "row-active" : "row-dim") : "";
                    return (
                      <tr key={p.person} className={rowClass}>
                        <td className="name-col"><PersonCell person={p.person} specialty={specialties[p.person]} /></td>
                        {p.cells.map((cell, ci) => {
                          const isToday = month.days[ci].date === today;
                          const dim = selectedSite !== null && cell.site !== selectedSite;
                          return (
                            <td key={ci} className={"day-col month-cell" + (isToday ? " today-col" : "")}>
                              {renderCell(cell.task, cell.site, dim)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(() => {
              const monthDates = month.days.map((d) => d.date);
              const monthWeekdays = month.days.map((d) => d.weekday);
              const monthComments = monthDates.flatMap((d) => commentsByDate[d] ?? []);
              return (
                <CommentsPanel
                  dates={monthDates}
                  weekdays={monthWeekdays}
                  comments={monthComments}
                  siteNames={siteNames}
                  siteColors={siteColors}
                  onAdd={handleAddComment}
                  onDelete={handleDeleteComment}
                />
              );
            })()}
          </section>
        ))}

        <div>
          {weeks.map((week, wi) => {
            const includesToday = today !== null && week.dates.includes(today);
            return (
              <section className="week-card" key={wi}>
                <div className="week-head">
                  <h2>{week.rangeLabel}</h2>
                  {includesToday && <span className="badge-today">Semana actual</span>}
                </div>
                <div className="table-scroll">
                  <table className="sched">
                    <thead>
                      <tr>
                        <th className="name-col">Colaborador</th>
                        {week.dates.map((d, i) => {
                          const isToday = d === today;
                          const dayNum = d ? d.slice(8, 10) : "";
                          const dayComments = d ? commentsByDate[d] ?? [] : [];
                          return (
                            <th key={i} className={"day-col" + (isToday ? " today-col" : "")}>
                              {week.weekdays[i]}
                              <span className="dnum">{dayNum}</span>
                              {dayComments.length > 0 && (
                                <span
                                  className="comment-badge"
                                  title={dayComments.map((c) => `${c.author}: ${c.text}`).join("\n")}
                                >
                                  {dayComments.length}
                                </span>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {week.people.map((p, pi) => {
                        const matchesPerson = selectedPerson === null || selectedPerson === p.person;
                        const rowClass = selectedPerson !== null ? (matchesPerson ? "row-active" : "row-dim") : "";
                        return (
                          <tr key={pi} className={rowClass}>
                            <td className="name-col"><PersonCell person={p.person} specialty={specialties[p.person]} /></td>
                            {p.tasks.map((t, ti) => {
                              const isToday = week.dates[ti] === today;
                              const site = p.sites[ti];
                              const dim = selectedSite !== null && site !== selectedSite;
                              return (
                                <td key={ti} className={"day-col" + (isToday ? " today-col" : "")}>
                                  {renderCell(t, site, dim)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="sites-row">
                  <span className="l">Obras en curso:</span>
                  {week.sites.map((s, si) => (
                    <span key={si}>{renderLegendChip(s)}</span>
                  ))}
                </div>
                {(() => {
                  const validIdx = week.dates
                    .map((d, i) => (d ? i : null))
                    .filter((i): i is number => i !== null);
                  const validDates = validIdx.map((i) => week.dates[i]);
                  const validWeekdays = validIdx.map((i) => week.weekdays[i]);
                  const weekComments = validDates.flatMap((d) => commentsByDate[d] ?? []);
                  return (
                    <CommentsPanel
                      dates={validDates}
                      weekdays={validWeekdays}
                      comments={weekComments}
                      siteNames={siteNames}
                      siteColors={siteColors}
                      onAdd={handleAddComment}
                      onDelete={handleDeleteComment}
                    />
                  );
                })()}
              </section>
            );
          })}
        </div>

        <section className="summary">
          <h2>Distribución de persona-días por obra</h2>
          <p className="hint">Suma de días asignados a cada obra, todo el período.</p>
          <div>
            {barEntries.map((e) => (
              <div className="bar-row" key={e.site}>
                <div className="lbl">
                  <span className="sw" style={{ background: e.color }} />
                  {e.site}
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(e.count / maxCount) * 100}%`, background: e.color }} />
                </div>
                <div className="n">{e.count}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="note">
          <strong>Sobre esta página:</strong> los datos y colores se leen directamente desde el archivo en Google Drive
          cada vez que alguien la visita, incluyendo el color de obra de cada celda. Si el archivo cambia de nombre o de
          carpeta, hay que actualizar el ID configurado en el proyecto.
        </footer>
      </div>
    </div>
  );
}
