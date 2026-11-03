/** Etapas del flujo general del área donde puede estar un proyecto (mismas del diagrama general). */
export const ETAPAS = [
  { key: "venta", label: "Venta" },
  { key: "contrato", label: "Contrato" },
  { key: "ingenieria", label: "Ingeniería y gestión" },
  { key: "operaciones", label: "Operaciones" },
  { key: "certificacion", label: "Certificación" },
  { key: "entrega", label: "Entrega y puesta en régimen" },
] as const;

export type EtapaKey = (typeof ETAPAS)[number]["key"];

export const etapaLabel = (k: string) => ETAPAS.find((e) => e.key === k)?.label ?? k;
export const esEtapa = (k: unknown): k is EtapaKey => ETAPAS.some((e) => e.key === k);

export interface ProyectoEstado {
  id: string;
  nombre: string;
  etapa: EtapaKey;
  /** N° del paso dentro del diagrama de la etapa (solo Ingeniería y Operaciones tienen pasos numerados). */
  paso: number | null;
  /** ISO. */
  actualizado: string;
}
