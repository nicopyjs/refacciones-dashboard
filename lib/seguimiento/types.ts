export type SegEstado = "En curso" | "Atrasado" | "En rechazo" | "Completo";

export interface SegEtapa {
  orden: number;
  /** N° de la etapa en el diagrama del proceso. */
  paso: number;
  etapa: string;
  area: string;
  tipo: string;
  /** 0 a 1. */
  avance: number;
  siguiente: string;
}

export interface SegEdificio {
  n: number;
  edificio: string;
  direccion: string;
  comuna: string;
  prospecto: string;
  /** "YYYY-MM-DD" o "". */
  inicio: string;
  etapa: string;
  paso: number | null;
  area: string;
  avance: number;
  ultimoMov: string;
  /** Días desde el último movimiento (null si está completo o no hay fecha). */
  dias: number | null;
  estado: SegEstado | "";
  contratoObra: string;
  contratoMant: string;
  siguiente: string;
  responsable: string;
  observaciones: string;
}

export interface SeguimientoData {
  generatedAt: string;
  diasMaxEtapa: number;
  edificios: SegEdificio[];
  etapas: SegEtapa[];
  resumen: {
    total: number;
    enCurso: number;
    atrasados: number;
    enRechazo: number;
    completos: number;
    avancePromedio: number;
    ambosFirmados: number;
  };
  porEtapa: { etapa: string; paso: number; area: string; n: number }[];
  porArea: { area: string; n: number }[];
}
