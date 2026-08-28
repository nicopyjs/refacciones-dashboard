"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { InsumoCategoria } from "@/lib/parseInsumos";
import TopNav from "./TopNav";
import "../app/dashboard.css";
import "../app/insumos/insumos.css";

const DESTINATARIO = "adquisiciones@nebchile.cl";
const COPIA = ["gerencia@nebchile.cl", "refacciones@nebchile.cl"];
const DIAS_HABILES_ENTREGA = 10;

function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

function ddmmyy(d: Date): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${String(d.getFullYear()).slice(-2)}`;
}

function isMobile(): boolean {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

interface Linea {
  numero: number | null;
  material: string;
  especificacion: string | null;
  unidad: string | null;
  cantidad: number;
}

export default function InsumosPedido({
  categoria,
  generatedAt,
  error,
}: {
  categoria: InsumoCategoria;
  generatedAt: string;
  error: string | null;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<number, string>>({});
  const [obra, setObra] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [filtro, setFiltro] = useState("");

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const seleccion = useMemo<Linea[]>(
    () =>
      categoria.items
        .map((it, i) => ({ ...it, cantidad: parseInt(qty[i] ?? "", 10) }))
        .filter((l): l is Linea => Number.isFinite(l.cantidad) && l.cantidad > 0),
    [qty, categoria.items]
  );

  const totalUnidades = useMemo(() => seleccion.reduce((s, l) => s + l.cantidad, 0), [seleccion]);

  const itemsFiltrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const conIdx = categoria.items.map((it, i) => ({ it, i }));
    if (!q) return conIdx;
    return conIdx.filter(({ it }) =>
      (it.material + " " + (it.especificacion ?? "")).toLowerCase().includes(q)
    );
  }, [filtro, categoria.items]);

  function setQ(i: number, v: string) {
    const clean = v.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    setQty((prev) => {
      const next = { ...prev };
      if (clean && clean !== "0") next[i] = clean;
      else delete next[i];
      return next;
    });
  }

  function bump(i: number, delta: number) {
    const cur = parseInt(qty[i] ?? "0", 10) || 0;
    setQ(i, String(Math.max(0, cur + delta)));
  }

  function limpiar() {
    setQty({});
  }

  function asunto(): string {
    const o = obra.trim();
    return `NEB Chile // Adquisiciones // ${o ? `${o} // ` : ""}Insumos`;
  }

  function lineasPedido(): string[] {
    return seleccion.map((l) => {
      const spec = l.especificacion ? ` ${l.especificacion}` : "";
      return `- ${l.cantidad} ${l.material}${spec}`;
    });
  }

  function cuerpoCorreo(): string {
    const entrega = ddmmyy(addBusinessDays(new Date(), DIAS_HABILES_ENTREGA));
    const out = [
      "Buenas tardes, estimados",
      "",
      "Junto con saludar, solicito gestión del siguiente pedido:",
      "Proveedor: ",
      `Centro de Costo: ${obra.trim()}`,
      "Plan de cuenta: Insumos",
      "Clasificador 1: Refacciones",
      "Clasificador 2: Sala de calderas",
      "Despacho: ",
      `Fecha de entrega: ${entrega}`,
      "Elementos a solicitar: ",
      ...lineasPedido(),
      "",
      "Saludos,",
    ];
    if (solicitante.trim()) out.push(solicitante.trim());
    return out.join("\n");
  }

  function mailtoUrl(): string {
    const cc = encodeURIComponent(COPIA.join(","));
    return `mailto:${DESTINATARIO}?cc=${cc}&subject=${encodeURIComponent(asunto())}&body=${encodeURIComponent(cuerpoCorreo())}`;
  }
  function gmailWebUrl(): string {
    const cc = encodeURIComponent(COPIA.join(","));
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(DESTINATARIO)}&cc=${cc}&su=${encodeURIComponent(asunto())}&body=${encodeURIComponent(cuerpoCorreo())}`;
  }

  function enviarCorreo() {
    if (isMobile()) {
      window.location.href = mailtoUrl();
    } else {
      const w = window.open(gmailWebUrl(), "_blank");
      if (!w) window.location.href = mailtoUrl();
    }
  }

  function enviarCorreoAlterno() {
    if (isMobile()) {
      window.open(gmailWebUrl(), "_blank");
    } else {
      window.location.href = mailtoUrl();
    }
  }

  async function descargarPDF() {
    const { default: JsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new JsPDF();
    doc.setFontSize(14);
    doc.text(`Pedido de insumos — ${categoria.nombre}`, 14, 18);

    doc.setFontSize(10);
    let y = 26;
    const meta = [
      `Centro de costo: ${obra.trim() || "—"}`,
      `Solicita: ${solicitante.trim() || "—"}`,
      `Fecha del pedido: ${ddmmyy(new Date())}`,
      `Fecha de entrega estimada: ${ddmmyy(addBusinessDays(new Date(), DIAS_HABILES_ENTREGA))} (${DIAS_HABILES_ENTREGA} días hábiles)`,
    ];
    for (const line of meta) {
      doc.text(line, 14, y);
      y += 5;
    }

    autoTable(doc, {
      startY: y + 3,
      head: [["N°", "Material", "Especificación", "Cantidad", "Unidad"]],
      body: seleccion.map((l) => [
        l.numero ?? "",
        l.material,
        l.especificacion ?? "",
        String(l.cantidad),
        l.unidad ?? "",
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235] },
      columnStyles: {
        0: { cellWidth: 12, halign: "right" },
        3: { cellWidth: 20, halign: "right" },
        4: { cellWidth: 18 },
      },
    });

    doc.save(`pedido-${categoria.slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  if (error) {
    return (
      <div className="viz-root">
        <div className="wrap">
          <TopNav active="insumos" />
          <header className="page-head">
            <h1>Insumos — {categoria.nombre}</h1>
            <p className="sub">No se pudo cargar la lista de materiales</p>
          </header>
          <div className="error-box" style={{ marginTop: 20 }}>
            <strong>Error:</strong> {error}
          </div>
        </div>
      </div>
    );
  }

  const inputBase =
    "h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";
  const disabled = seleccion.length === 0;

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="insumos" />
        <header className="page-head">
          <h1>Insumos — {categoria.nombre}</h1>
          <p className="sub">
            Ajusta la cantidad de cada material. Luego descarga el PDF o envía el pedido a
            Adquisiciones.
          </p>
          <div className="meta">
            <span>
              Fuente:{" "}
              <strong style={{ color: "var(--text-secondary)" }}>{categoria.hoja || "Insumos"}</strong>{" "}
              (Google Drive)
            </span>
            <span className="dot" />
            <span>última lectura {new Date(generatedAt).toLocaleString("es-CL")}</span>
            <span className="dot" />
            <button
              type="button"
              onClick={logout}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent)",
                cursor: "pointer",
                font: "inherit",
                padding: 0,
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <input
            className={inputBase}
            type="text"
            placeholder="Centro de costo (obra / edificio)"
            value={obra}
            onChange={(e) => setObra(e.target.value)}
            maxLength={80}
          />
          <input
            className={inputBase}
            type="text"
            placeholder="Tu nombre"
            value={solicitante}
            onChange={(e) => setSolicitante(e.target.value)}
            maxLength={60}
          />
        </div>

        <input
          className={`${inputBase} mt-2`}
          type="text"
          inputMode="search"
          placeholder="Buscar material…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />

        <ul className="mt-3 flex flex-col gap-2 pb-2">
          {itemsFiltrados.length === 0 && (
            <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              No hay materiales que coincidan con “{filtro.trim()}”.
            </li>
          )}
          {itemsFiltrados.map(({ it, i }) => {
            const v = qty[i] ?? "";
            return (
              <li
                key={i}
                className={`flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:gap-4 ${
                  v
                    ? "border-blue-500/60 bg-blue-50/70 dark:border-blue-500/40 dark:bg-blue-500/10"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {it.material}
                    </span>
                    {it.especificacion && (
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {it.especificacion}
                      </span>
                    )}
                  </div>
                  {it.unidad && (
                    <span className="mt-1 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {it.unidad}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => bump(i, -1)}
                    disabled={!v}
                    aria-label={`Restar cantidad de ${it.material}`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-xl font-semibold leading-none text-slate-700 transition active:scale-95 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={v}
                    onChange={(e) => setQ(i, e.target.value)}
                    placeholder="0"
                    aria-label={`Cantidad de ${it.material}`}
                    className="h-10 w-14 appearance-none rounded-lg border border-slate-300 bg-white text-center text-base tabular-nums text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => bump(i, 1)}
                    aria-label={`Sumar cantidad de ${it.material}`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-600 bg-blue-600 text-xl font-semibold leading-none text-white transition active:scale-95"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="sticky bottom-0 z-20 mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/95">
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {seleccion.length === 0
              ? "Sin materiales seleccionados"
              : `${seleccion.length} material${seleccion.length === 1 ? "" : "es"} · ${totalUnidades} en total`}
          </span>
          <div className="flex gap-2">
            {seleccion.length > 0 && (
              <button
                type="button"
                onClick={limpiar}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Limpiar
              </button>
            )}
            <button
              type="button"
              onClick={descargarPDF}
              disabled={disabled}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition active:scale-95 disabled:opacity-40 sm:flex-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              Descargar PDF
            </button>
            <button
              type="button"
              onClick={enviarCorreo}
              disabled={disabled}
              className="flex-1 rounded-lg border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40 sm:flex-none"
            >
              Enviar correo
            </button>
          </div>
        </div>

        {seleccion.length > 0 && (
          <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
            ¿No se abrió bien?{" "}
            <button
              type="button"
              onClick={enviarCorreoAlterno}
              className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400"
            >
              Abrir en {isMobile() ? "Gmail web" : "tu app de correo"}
            </button>
          </p>
        )}

        <footer className="note">
          <strong>Sobre esta página:</strong> el botón de correo abre Gmail (en el celular, la app) con
          el pedido ya escrito hacia <strong>{DESTINATARIO}</strong>, con copia a Gerencia y
          Refacciones. La fecha de entrega se calcula a {DIAS_HABILES_ENTREGA} días hábiles del pedido.
          Las cantidades no se guardan.
        </footer>
      </div>
    </div>
  );
}
