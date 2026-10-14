"use client";


import { Fragment } from "react";
import DiagramaZoom, { type LegendItem } from "./DiagramaZoom";
import { METROGAS_HTML } from "@/lib/diagramaMetrogasHtml";

const LEGEND: LegendItem[] = [
  { label: "NEB Chile (empresa)", bg: "#1F6F8B" },
  { label: "Comunidad", bg: "#7B5EA7" },
  { label: "Gestor Metrogas", bg: "#D9822B" },
  { label: "Legal Metrogas", bg: "#B0623A" },
  { label: "Comercial / financiero Metrogas", bg: "#8A6D1F" },
  { label: "Firmantes Metrogas", bg: "#2E6E5E" },
  { label: "Devolución para regularizar", line: "#C8423A" },
  { label: "Aprobado", line: "#23895B" },
];

const NEB = "#1F6F8B", MG = "#D9822B", LEGAL = "#B0623A", COM = "#8A6D1F", CLI = "#7B5EA7", SIG = "#2E6E5E";

const FACTS = [
  { crit: true, k: "Plazo observado", b: "Hasta 100 días", p: "Es lo que ha llegado a demorar este proceso. Sin plazos definidos por etapa no podemos comprometer fechas a las comunidades." },
  { k: "Etapa crítica", b: "Certificado de aprobación legal", p: "Habilita la carta de oferta y es el paso que más se demora. Cada devolución al gestor obliga a pasar otra vez por Legal." },
  { k: "Plazo de la comunidad", b: "1 a 2 meses", p: "Desde que recibe la carta de oferta hasta que avisa a Metrogas qué empresa eligió." },
  { k: "Liberación de códigos", b: "3 firmas", p: "Paula Álvarez, Gianni Bozzo y Sebastián (gerente)." },
];

const LOOPS = [
  { t: "Legal tiene observaciones", p: "Vuelve al gestor, que regulariza la documentación con la comunidad y la reingresa a Legal." },
  { t: "Error en los números del contrato", p: "Comercial lo devuelve al gestor, que lo regulariza (sea error propio o de las empresas). El contrato corregido vuelve a pasar por Legal y luego por Comercial." },
];

type Step = [color: string, who: string, what: string, note: string];
const GROUPS: [string, Step[]][] = [
  ["Fase 2 · Oferta", [
    [NEB, "NEB Chile", "Envía el presupuesto al gestor", "Proyecto y presupuesto de la refacción."],
    [MG, "Gestor Metrogas", "Solicita documentación a la comunidad", ""],
    [CLI, "Comunidad", "Envía la documentación al gestor", ""],
    [MG, "Gestor Metrogas", "Ingresa documentación y contrato a Legal", ""],
    [LEGAL, "Legal Metrogas", "Revisa la documentación y el contrato", "Si hay observaciones, vuelve al gestor para regularizar con la comunidad."],
    [LEGAL, "Legal Metrogas", "Emite el certificado de aprobación legal", "Habilita la carta de oferta. Es la etapa que más se demora."],
    [COM, "Comercial Metrogas", "Revisa los números del contrato y el financiamiento", "Si hay un error, vuelve al gestor y luego otra vez a Legal."],
    [MG, "Gestor Metrogas", "Envía la carta de oferta al cliente", ""],
  ]],
  ["Fase 3 · Decisión de la comunidad", [
    [CLI, "Comunidad", "Recibe la carta de oferta", "Tiene alrededor de un mes para decidir, hasta dos meses como máximo."],
    [CLI, "Comunidad", "Entrevista a las distintas empresas", ""],
    [CLI, "Comunidad", "Avisa a Metrogas con qué empresa hará el proyecto", ""],
  ]],
  ["Fase 4 · Liberación de fondos", [
    [MG, "Gestor Metrogas", "Solicita documentos a la empresa elegida", "Requisito para liberar los fondos."],
    [NEB, "Empresa elegida", "Entrega contratos y Carta Gantt", "Contrato de mantenimiento, contrato de construcción o instalación y Carta Gantt del proyecto."],
    [MG, "Metrogas + NEB + Comunidad", "Reunión de inicio", ""],
    [SIG, "Firmantes Metrogas", "Liberación de códigos", "Firman Paula Álvarez, Gianni Bozzo y Sebastián (gerente)."],
  ]],
];

export default function MetrogasDiagram() {
  let k = 0;
  let r = 0;
  return (
    <div>
      <DiagramaZoom html={METROGAS_HTML} legend={LEGEND} initialZoom={2} crop={{ x0: 0, y0: 0, w: 3600, h: 912, canvasW: 3600, canvasH: 912 }} />

      <div className="mg-block mg-facts">
        {FACTS.map((f) => (
          <div key={f.k} className={`mg-fact${f.crit ? " crit" : ""}`}>
            <span className="k">{f.k}</span><b>{f.b}</b><p>{f.p}</p>
          </div>
        ))}
      </div>

      <section className="mg-block">
        <h3>Las dos vueltas atrás</h3>
        <div className="mg-loops">
          {LOOPS.map((l) => <div key={l.t} className="mg-loop"><b>{l.t}</b><p>{l.p}</p></div>)}
        </div>
      </section>

      <section className="mg-block">
        <h3>Paso a paso</h3>
        {GROUPS.map(([g, steps]) => (
          <div key={g}>
            <div className="mg-eyebrow">{g}</div>
            <ol className="mg-steps">
              {steps.map((s) => {
                k++;
                return (
                  <li key={k}>
                    <span className="mg-num" style={{ background: s[0] }}>{k}</span>
                    <span className="mg-who" style={{ color: s[0] }}>{s[1]}</span>
                    <span className="mg-what">{s[2]}{s[3] && <small>{s[3]}</small>}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>

      <section className="mg-block mg-req">
        <div className="mg-eyebrow" style={{ color: MG }}>Solicitud de NEB Chile a Metrogas</div>
        <h3>¿En qué etapas hay un plazo definido?</h3>
        <p className="sub">Para planificar nuestra operación y dar fechas confiables a las comunidades, les pedimos indicar en cuáles de estas etapas existe hoy un plazo con certeza y cuál es. Donde no lo haya, nos sirve saber de qué depende.</p>
        <div className="mg-tbl">
          <table>
            <thead><tr><th>#</th><th>Etapa</th><th>Responsable</th><th>¿Plazo definido?</th><th>Plazo (días hábiles)</th><th>Comentario</th></tr></thead>
            <tbody>
              {GROUPS.map(([g, steps]) => (
                <Fragment key={g}>
                  <tr className="grp"><td colSpan={6}>{g}</td></tr>
                  {steps.map((s) => {
                    r++;
                    return (
                      <tr key={r}>
                        <td className="n">{r}</td>
                        <td><b>{s[2]}</b></td>
                        <td style={{ color: s[0], fontWeight: 600 }}>{s[1]}</td>
                        <td className="chk">☐ Sí&nbsp;&nbsp;☐ No</td>
                        <td className="blank" /><td className="blank" />
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="note">Preparado por NEB Chile · Área de Refacciones (RCT).</p>
    </div>
  );
}
