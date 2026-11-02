import type { jsPDF } from "jspdf";
import type { CellDef, RowInput, UserOptions } from "jspdf-autotable";
import { EMPRESA, armarOferta, type CalcState } from "./calculadora";

type RGB = [number, number, number];

const NAVY: RGB = [31, 29, 51];
const GOLD: RGB = [212, 191, 77];
const CREAM: RGB = [253, 251, 228];
const BORDER: RGB = [222, 222, 228];
const ZEBRA: RGB = [247, 247, 250];
const TEXT: RGB = [34, 34, 42];
const MUTED: RGB = [128, 128, 138];
const RED: RGB = [192, 57, 43];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 15;
const W = PAGE_W - M * 2;
const TOP = 18;
const BOTTOM = 22;

/** Helvetica estándar solo cubre WinAnsi: se reemplazan los símbolos que no están. */
const clean = (s: string) => s.replace(/−/g, "-").replace(/→/g, "->").replace(/[‘’]/g, "'");
const money = (n: number) => `$ ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const num = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
const pctTxt = (n: number) => `${n.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;

function fechaTxt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

/** Logo amarillo con fondo transparente (public/logos/neb-pdf.png) como data URL; null si no se pudo cargar. */
async function cargarLogo(): Promise<string | null> {
  try {
    const res = await fetch("/logos/neb-pdf.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((ok) => {
      const fr = new FileReader();
      fr.onload = () => ok(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => ok(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function descargarPresupuestoPdf(s: CalcState): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }, logo] = await Promise.all([import("jspdf"), import("jspdf-autotable"), cargarLogo()]);
  const doc: jsPDF = new JsPDF({ unit: "mm", format: "a4", compress: true });
  const d = s.doc;
  const of = armarOferta(s);
  const codigo = d.codigo.trim();
  const ivaTxt = `IVA (${pctTxt(s.params.iva)})`;
  let y = 0;

  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const ensure = (h: number) => {
    if (y + h > PAGE_H - BOTTOM) {
      doc.addPage();
      y = TOP;
    }
  };

  const table = (opts: UserOptions) => {
    autoTable(doc, {
      theme: "plain",
      margin: { left: M, right: M, top: TOP, bottom: BOTTOM },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2.3, textColor: TEXT, lineColor: BORDER, lineWidth: 0.25, valign: "middle", overflow: "linebreak" },
      ...opts,
    });
    y = finalY();
  };

  // ───────── Encabezado ─────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 38, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(214, 214, 226);
  doc.setCharSpace(0.55);
  doc.text(clean(["NEB CHILE", d.cliente.trim().toUpperCase()].filter(Boolean).join("  ·  ")), M, 12.5);
  doc.setCharSpace(0);
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(clean(codigo ? `Presupuesto ${codigo}` : "Presupuesto"), M, 23);

  const emitido = `Emitido el ${fechaTxt(d.fecha)}`;
  doc.setFontSize(8);
  const pillW = doc.getTextWidth(emitido) + 9;
  doc.setFillColor(...GOLD);
  doc.roundedRect(M, 27.6, pillW, 6.6, 3.3, 3.3, "F");
  doc.setTextColor(...NAVY);
  doc.text(emitido, M + 4.5, 32);

  let logoOk = false;
  if (logo) {
    try {
      const lw = 40;
      doc.addImage(logo, "PNG", PAGE_W - M - lw + 2, 9, lw, (lw * 175) / 400);
      logoOk = true;
    } catch {
      logoOk = false;
    }
  }
  if (!logoOk) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(...GOLD);
    doc.text("neb", PAGE_W - M, 24, { align: "right" });
  }
  y = 47;

  // ───────── Utilidades de diseño ─────────
  const section = (title: string, minSpace = 18) => {
    ensure(minSpace);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.setCharSpace(0.42);
    doc.text(clean(title.toUpperCase()), M, y);
    doc.setCharSpace(0);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.7);
    doc.line(M, y + 2.2, M + W, y + 2.2);
    y += 5.2;
  };

  const callout = (titulo: string, texto: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(clean(texto), W - 11) as string[];
    const h = 5 + 5 + lines.length * 4.1 + 3.5;
    ensure(h + 2);
    doc.setFillColor(...CREAM);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.25);
    doc.rect(M, y, W, h, "FD");
    doc.setFillColor(...GOLD);
    doc.rect(M, y, 1.3, h, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT);
    doc.text(clean(titulo), M + 6, y + 6.5);
    doc.setFont("helvetica", "normal");
    doc.text(lines, M + 6, y + 11.5);
    y += h + 6;
  };

  /** Tabla de pares etiqueta/valor en dos columnas, con la etiqueta sobre fondo amarillo. */
  const gridPares = (pares: [string, string][]) => {
    const body: RowInput[] = [];
    for (let i = 0; i < pares.length; i += 2) {
      const a = pares[i];
      const b = pares[i + 1];
      body.push([clean(a[0]), clean(a[1]), b ? clean(b[0]) : "", b ? clean(b[1]) : ""]);
    }
    table({
      startY: y,
      body,
      columnStyles: {
        0: { cellWidth: 33, fillColor: GOLD, fontStyle: "bold" },
        1: { cellWidth: 57 },
        2: { cellWidth: 33, fillColor: GOLD, fontStyle: "bold" },
        3: { cellWidth: 57 },
      },
      didParseCell: (h) => {
        if (h.section === "body" && h.column.index >= 2 && !pares[h.row.index * 2 + 1]) {
          h.cell.styles.fillColor = [255, 255, 255];
          h.cell.styles.lineWidth = 0;
        }
      },
    });
    y += 7.5;
  };

  // ───────── Datos del cliente ─────────
  const info: [string, string][] = [];
  if (d.cliente.trim()) info.push(["Cliente", d.cliente.trim()]);
  if (d.observacion.trim()) info.push(["Observación", d.observacion.trim()]);
  if (codigo) info.push(["Código", codigo]);
  if (info.length) {
    table({
      startY: y,
      body: info.map(([a, b]) => [clean(a), clean(b)]),
      columnStyles: { 0: { cellWidth: 40, fillColor: GOLD, fontStyle: "bold", fontSize: 9.5 }, 1: { cellWidth: W - 40, fontSize: 9.5 } },
    });
    y += 7.5;
  }

  // ───────── Detalle de la oferta ─────────
  section("Detalle de la oferta", 50);
  table({
    startY: y,
    head: [["ÍTEM", "CÓDIGO", "CANT.", "DETALLE", "VALOR UNITARIO (NETO)", "PRECIO TOTAL (NETO)"]],
    body: of.lineas.map((l) => [clean(l.item), clean(l.codigo), num(l.cantidad), clean(l.detalle), money(l.unitario), money(l.total)]),
    alternateRowStyles: { fillColor: ZEBRA },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.2, cellPadding: 3, lineWidth: 0 },
    columnStyles: {
      0: { cellWidth: 36, fontStyle: "bold" },
      1: { cellWidth: 17 },
      2: { cellWidth: 14, halign: "right" },
      3: { cellWidth: "auto" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
    },
    didParseCell: (h) => {
      if (h.section === "head" && h.column.index >= 2 && h.column.index !== 3) h.cell.styles.halign = "right";
    },
  });
  y += 6;

  if (d.incluyeManoObra.trim()) callout("La mano de obra incluye:", d.incluyeManoObra.trim());

  // ───────── Especificaciones técnicas ─────────
  const specs = d.specs.filter((x) => x.label.trim() && x.value.trim());
  if (specs.length) {
    section(d.specsTitulo.trim() || "Especificaciones técnicas", 36);
    gridPares(specs.map((x) => [x.label.trim(), x.value.trim()]));
  }

  // ───────── Resumen económico ─────────
  section("Resumen económico", 36);
  const resW = 96;
  table({
    startY: y,
    margin: { left: PAGE_W - M - resW, right: M, top: TOP, bottom: BOTTOM },
    tableWidth: resW,
    body: [
      ["Subtotal neto", money(of.neto)],
      [ivaTxt, money(of.iva)],
      ["Total bruto (neto + IVA)", money(of.total)],
    ],
    columnStyles: { 0: { cellWidth: resW * 0.62 }, 1: { cellWidth: resW * 0.38, halign: "right" } },
    didParseCell: (h) => {
      if (h.row.index === 2) {
        h.cell.styles.fillColor = GOLD;
        h.cell.styles.fontStyle = "bold";
        h.cell.styles.fontSize = 10;
      }
    },
  });
  y += 8;

  // ───────── Condiciones de pago ─────────
  const conCuotas = d.pagoCuotas && of.cuotas.length > 0;
  const conContado = d.pagoContado;
  if (conCuotas || conContado) {
    section("Condiciones de pago", 78);
    const dos = conCuotas && conContado;
    const boxW = dos ? (W - 6) / 2 : 110;
    const startY = y;
    let finA = startY;
    let finB = startY;

    const totalLine = (h: { section: string; row: { index: number }; cell: { x: number; y: number; width: number } }, last: number) => {
      if (h.section === "body" && h.row.index === last) {
        doc.setDrawColor(...NAVY);
        doc.setLineWidth(0.7);
        doc.line(h.cell.x, h.cell.y, h.cell.x + h.cell.width, h.cell.y);
      }
    };
    const cabecera = (kicker: string, titulo: string, fill: RGB, color: RGB): CellDef[][] => [
      [{ content: kicker, colSpan: 2, styles: { fillColor: fill, textColor: color, fontSize: 6.8, fontStyle: "bold", cellPadding: { top: 3, bottom: 0.4, left: 3, right: 3 }, lineWidth: 0 } }],
      [{ content: clean(titulo), colSpan: 2, styles: { fillColor: fill, textColor: color, fontSize: 9.5, fontStyle: "bold", cellPadding: { top: 0.4, bottom: 3, left: 3, right: 3 }, lineWidth: 0 } }],
    ];

    if (conCuotas) {
      const nA = of.cuotas.length;
      const bodyA: RowInput[] = of.cuotas.map((c) => [clean(`${c.label} (${pctTxt(c.pct)})`), money(c.monto)]);
      bodyA.push(["Total bruto", money(of.total)]);
      table({
        startY,
        margin: { left: M, right: PAGE_W - M - boxW, top: TOP, bottom: BOTTOM },
        tableWidth: boxW,
        head: cabecera("O P C I Ó N   A", nA === 1 ? "Pago en 1 cuota" : `Pago en ${nA} cuotas`, NAVY, [255, 255, 255]),
        body: bodyA,
        columnStyles: { 0: { cellWidth: boxW * 0.7 }, 1: { cellWidth: boxW * 0.3, halign: "right" } },
        didParseCell: (h) => {
          if (h.section === "body" && h.row.index === nA) h.cell.styles.fontStyle = "bold";
        },
        didDrawCell: (h) => totalLine(h, nA),
      });
      finA = y;
    }

    if (conContado) {
      const c = of.contado;
      table({
        startY,
        margin: { left: dos ? M + boxW + 6 : M, right: dos ? M : PAGE_W - M - boxW, top: TOP, bottom: BOTTOM },
        tableWidth: boxW,
        head: cabecera("O P C I Ó N   B   ·   C O N   D E S C U E N T O", `Pago contado - ${pctTxt(c.dctoPct)} de descuento`, GOLD, NAVY),
        body: [
          ["Subtotal neto", money(of.neto)],
          [`Descuento ${pctTxt(c.dctoPct)}`, `- ${money(c.descuento)}`],
          ["Total con descuento (neto)", money(c.netoConDcto)],
          [ivaTxt, money(c.iva)],
          ["Total bruto", money(c.total)],
        ],
        columnStyles: { 0: { cellWidth: boxW * 0.7 }, 1: { cellWidth: boxW * 0.3, halign: "right" } },
        didParseCell: (h) => {
          if (h.section !== "body") return;
          if (h.row.index === 4) h.cell.styles.fontStyle = "bold";
          if (h.row.index === 1 && h.column.index === 1) {
            h.cell.styles.textColor = RED;
            h.cell.styles.fontStyle = "bold";
          }
        },
        didDrawCell: (h) => totalLine(h, 4),
      });
      finB = y;
    }
    y = Math.max(finA, finB) + 8;

    if (dos && of.contado.ahorro > 0) {
      callout("Ahorro Opción B:", `${money(of.contado.ahorro)} respecto del total bruto de la Opción A. Aplica únicamente con pago del 100% al momento de la aceptación del presupuesto.`);
    }
  }

  // ───────── Datos para transferencia ─────────
  if (d.transferencia) {
    const pares: [string, string][] = [
      ["Titular", d.titular],
      ["Banco", d.banco],
      ["RUT", d.rut],
      ["Tipo de cuenta", d.tipoCuenta],
      ["Correo comprobante", d.correoComprobante],
      ["N° de cuenta", d.numeroCuenta],
    ];
    section("Datos para transferencia", 52);
    gridPares(pares.map(([a, b]) => [a, b.trim() || "-"]));
  }

  // ───────── Condiciones generales ─────────
  const condiciones = d.condiciones.split("\n").map((l) => l.trim()).filter(Boolean);
  if (condiciones.length) {
    section("Condiciones generales", 34);
    y += 2;
    doc.setFontSize(9);
    const maxW = W - 5;
    for (const c of condiciones) {
      const txt = clean(c);
      const idx = txt.indexOf(":");
      const lead = idx > 0 && idx < 34 ? txt.slice(0, idx + 1) : "";
      doc.setFont("helvetica", "bold");
      const leadW = lead ? doc.getTextWidth(`${lead} `) : 0;
      doc.setFont("helvetica", "normal");

      // Ajuste de línea a mano: la primera fila descuenta el ancho del encabezado en negrita.
      const words = (lead ? txt.slice(idx + 1) : txt).trim().split(/\s+/);
      const rows: string[] = [];
      let cur = "";
      for (const w of words) {
        const avail = maxW - (rows.length === 0 ? leadW : 0);
        const probe = cur ? `${cur} ${w}` : w;
        if (cur && doc.getTextWidth(probe) > avail) {
          rows.push(cur);
          cur = w;
        } else cur = probe;
      }
      rows.push(cur);

      ensure(rows.length * 4.3 + 2.2);
      doc.setFillColor(...TEXT);
      doc.circle(M + 1.5, y - 1, 0.55, "F");
      doc.setTextColor(...TEXT);
      rows.forEach((row, i) => {
        const yy = y + i * 4.3;
        if (i === 0 && lead) {
          doc.setFont("helvetica", "bold");
          doc.text(lead, M + 5, yy);
          doc.setFont("helvetica", "normal");
          doc.text(row, M + 5 + leadW, yy);
        } else {
          doc.text(row, M + 5, yy);
        }
      });
      y += rows.length * 4.3 + 2.2;
    }
  }

  // ───────── Firma ─────────
  const firma = d.firma.split("\n").map((l) => l.trim()).filter(Boolean);
  if (firma.length) {
    ensure(22);
    y += 10;
    const cx = PAGE_W / 2;
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.3);
    doc.line(cx - 32, y, cx + 32, y);
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    firma.forEach((l, i) => {
      doc.setFont("helvetica", "bold");
      doc.text(clean(l), cx, y + 4.5 + i * 3.8, { align: "center" });
    });
  }

  // ───────── Pie de página con numeración ─────────
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.25);
    doc.line(M, PAGE_H - 13, PAGE_W - M, PAGE_H - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    const pie = `${EMPRESA.nombre} (${EMPRESA.marca}) · RUT ${EMPRESA.rut} · ${EMPRESA.correo}${codigo ? ` · Presupuesto ${codigo}` : ""} · Página ${p} de ${n}`;
    doc.text(clean(pie), PAGE_W / 2, PAGE_H - 8.5, { align: "center" });
  }

  const nombre = (codigo || "Presupuesto").replace(/[^\w\-. ]+/g, "").trim() || "Presupuesto";
  doc.save(`${nombre}.pdf`);
}
