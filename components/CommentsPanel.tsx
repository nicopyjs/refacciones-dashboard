"use client";

import { useState } from "react";
import type { Comment } from "@/lib/comments";

const MONTH_ABBR_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTH_ABBR_ES[m - 1]}`;
}

function textColorFor(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#141414" : "#ffffff";
}

export default function CommentsPanel({
  dates,
  weekdays,
  comments,
  siteNames,
  siteColors,
  onAdd,
  onDelete,
}: {
  dates: string[];
  weekdays: string[];
  comments: Comment[];
  siteNames: string[];
  siteColors: Record<string, string>;
  onAdd: (date: string, site: string | null, author: string, text: string) => Promise<void>;
  onDelete: (date: string, id: string) => Promise<void>;
}) {
  const [date, setDate] = useState(dates[0] ?? "");
  const [site, setSite] = useState("");
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !date || busy) return;
    setBusy(true);
    try {
      await onAdd(date, site || null, author, text);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="comments-panel">
      <div className="comments-head">Comentarios y recordatorios</div>
      {comments.length > 0 && (
        <ul className="comments-list">
          {comments.map((c) => (
            <li key={c.id}>
              <span className="c-date">{fmtShort(c.date)}</span>
              {c.site && (
                <span
                  className="c-site"
                  style={{
                    background: siteColors[c.site] || "#7f7f7f",
                    color: textColorFor(siteColors[c.site] || "#7f7f7f"),
                  }}
                >
                  {c.site}
                </span>
              )}
              <span className="c-author">{c.author}:</span>
              <span className="c-text">{c.text}</span>
              <button
                type="button"
                className="c-delete"
                onClick={() => onDelete(c.date, c.id)}
                aria-label="Borrar comentario"
                title="Borrar"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="comments-form" onSubmit={submit}>
        <select value={date} onChange={(e) => setDate(e.target.value)} aria-label="Día">
          {dates.map((d, i) => (
            <option key={d} value={d}>
              {weekdays[i]} {fmtShort(d)}
            </option>
          ))}
        </select>
        <select value={site} onChange={(e) => setSite(e.target.value)} aria-label="Obra">
          <option value="">Sin obra específica</option>
          {siteNames.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Tu nombre"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={60}
        />
        <input
          type="text"
          placeholder="Ej: necesito materiales para este día…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <button type="submit" disabled={busy || !text.trim()}>Agregar</button>
      </form>
    </div>
  );
}
