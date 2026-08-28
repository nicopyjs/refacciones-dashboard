"use client";

import { useMemo, useState } from "react";
import type { InsumoCategoria } from "@/lib/parseInsumos";
import TopNav from "./TopNav";
import "../app/dashboard.css";

const DESTINATARIO = "adquisiciones@nebchile.cl";

const MONTH_ABBR_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fechaHoy(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")} ${MONTH_ABBR_ES[d.getMonth()]} ${d.getFullYear()}`;
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
  const [qty, setQty] = useState<Record<number, string>>({});
  const [obra, setObra] = useState("");
  const [solicitante, setSolicitante] = useState("");

  const seleccion = useMemo<Linea[]>(
    () =>
      categoria.items
        .map((it, i) => ({ ...it, cantidad: parseInt(qty[i] ?? "", 10) }))
        .filter((l): l is Linea => Number.isFinite(l.cantidad) && l.cantidad > 0),
    [qty, categoria.items]
  );

  function setCantidad(i: number, v: string) {
    const limpio = v.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    setQty((prev) => {
      const next = { ...prev };
      if (limpio) next[i] = limpio;
      else delete next[i];
      return next;
    });
  }

  function limpiar() {
    setQty({});
  }

  function encabezado(): string[] {
    const l = [`Pedido de materiales — ${categoria.nombre}`];
    if (obra.trim()) l.push(`Obra: ${obra.trim()}`);
    if (solicitante.trim()) l.push(`Solicita: ${solicitante.trim()}`);
    l.push(`Fecha: ${fechaHoy()}`);
    return l;
  }

  function cuerpoCorreo(): string {
    const lineas = seleccion.map((l) => {
      const spec = l.especificacion ? ` (${l.especificacion})` : "";
      const u = l.unidad ? ` ${l.unidad}` : "";
      return `• ${l.material}${spec}: ${l.cantidad}${u}`;
    });
    return [
      ...encabezado(),
      "",
      ...lineas,
      "",
      `Total: ${seleccion.length} materiales`,
    ].join("\n");
  }

  function asunto(): string {
    return `Pedido de materiales — ${categoria.nombre}${obra.trim() ? ` — ${obra.trim()}` : ""}`;
  }

  function enviarCorreo() {
    const su = encodeURIComponent(asunto());
    const body = encodeURIComponent(cuerpoCorreo());
    const to = encodeURIComponent(DESTINATARIO);
    const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}&body=${body}`;
    const win = window.open(gmail, "_blank");
    if (!win) {
      window.location.href = `mailto:${DESTINATARIO}?subject=${su}&body=${body}`;
    }
  }

  async function descargarPDF() {
    const { default: JsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new JsPDF();
    doc.setFontSize(14);
    doc.text(`Pedido de materiales — ${categoria.nombre}`, 14, 18);

    doc.setFontSize(10);
    let y = 26;
    for (const linea of encabezado().slice(1)) {
      doc.text(linea, 14, y);
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
      headStyles: { fillColor: [42, 120, 214] },
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

  const hayUnidad = categoria.items.some((it) => it.unidad);
  const disabled = seleccion.length === 0;

  return (
    <div className="viz-root">
      <div className="wrap">
        <TopNav active="insumos" />
        <header className="page-head">
          <h1>Insumos — {categoria.nombre}</h1>
          <p className="sub">
            Ingresa la cantidad que necesitas en cada material. Luego descarga el PDF o envía el pedido
            a Adquisiciones.
          </p>
          <div className="meta">
            <span>Fuente: <strong style={{ color: "var(--text-secondary)" }}>{categoria.hoja || "Insumos"}</strong> (Google Drive)</span>
            <span className="dot" />
            <span>última lectura {new Date(generatedAt).toLocaleString("es-CL")}</span>
          </div>
        </header>

        <div className="insumo-form">
          <input
            className="search-box"
            type="text"
            placeholder="Obra / edificio"
            value={obra}
            onChange={(e) => setObra(e.target.value)}
            maxLength={80}
          />
          <input
            className="search-box"
            type="text"
            placeholder="Tu nombre"
            value={solicitante}
            onChange={(e) => setSolicitante(e.target.value)}
            maxLength={60}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table insumo-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Material</th>
                <th>Especificación</th>
                {hayUnidad && <th>Unidad</th>}
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {categoria.items.map((it, i) => {
                const val = qty[i] ?? "";
                return (
                  <tr key={i} className={val ? "insumo-row-active" : ""}>
                    <td>{it.numero ?? i + 1}</td>
                    <td className="obra-col">{it.material}</td>
                    <td className="wrap-col">{it.especificacion ?? "—"}</td>
                    {hayUnidad && <td>{it.unidad ?? "—"}</td>}
                    <td>
                      <input
                        className="qty-input"
                        type="text"
                        inputMode="numeric"
                        aria-label={`Cantidad de ${it.material}`}
                        value={val}
                        onChange={(e) => setCantidad(i, e.target.value)}
                        placeholder="0"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="insumo-actions">
          <span className="insumo-actions-count">
            {seleccion.length === 0
              ? "Sin materiales seleccionados"
              : `${seleccion.length} material${seleccion.length === 1 ? "" : "es"} seleccionado${seleccion.length === 1 ? "" : "s"}`}
          </span>
          <div className="insumo-actions-btns">
            {seleccion.length > 0 && (
              <button type="button" className="reset" onClick={limpiar}>Limpiar</button>
            )}
            <button type="button" className="btn-secondary" onClick={descargarPDF} disabled={disabled}>
              Descargar PDF
            </button>
            <button type="button" className="btn-primary" onClick={enviarCorreo} disabled={disabled}>
              Enviar correo a Adquisiciones
            </button>
          </div>
        </div>

        <footer className="note">
          <strong>Sobre esta página:</strong> el botón de correo abre Gmail (o tu app de correo) con el
          pedido ya escrito hacia <strong>{DESTINATARIO}</strong>. Las cantidades no se guardan en
          ningún lado.
        </footer>
      </div>
    </div>
  );
}
