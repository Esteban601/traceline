import type { Database } from "@/lib/database.types";

export type EstadoSolicitud = Database["public"]["Enums"]["estado_solicitud"];

export type Tono = "ambar" | "azul" | "rojo" | "verde" | "gris";
export type BucketKpi = "pendientes" | "recibidas" | "observaciones" | "validadas";

type EstadoMeta = {
  label: string;
  tono: Tono;
  bucket: BucketKpi;
  /** Orden de prioridad: observaciones primero, luego pendientes, etc. */
  rank: number;
};

export const ESTADO_META: Record<EstadoSolicitud, EstadoMeta> = {
  observaciones: { label: "Con observaciones", tono: "rojo", bucket: "observaciones", rank: 0 },
  pendiente: { label: "Pendiente", tono: "ambar", bucket: "pendientes", rank: 1 },
  solicitado: { label: "Solicitado", tono: "ambar", bucket: "pendientes", rank: 2 },
  recibido: { label: "Recibido", tono: "azul", bucket: "recibidas", rank: 3 },
  en_revision: { label: "En revisión", tono: "azul", bucket: "recibidas", rank: 4 },
  validado: { label: "Validado", tono: "verde", bucket: "validadas", rank: 5 },
  congelado: { label: "Congelado", tono: "gris", bucket: "validadas", rank: 6 },
};

/** Clases de color por tono (texto / fondo tint / borde). Estáticas para Tailwind. */
export const TONO_CLASSES: Record<Tono, { text: string; bg: string; border: string; dot: string }> = {
  ambar: { text: "text-ambar", bg: "bg-ambar/10", border: "border-ambar/25", dot: "bg-ambar" },
  azul: { text: "text-azul", bg: "bg-azul/10", border: "border-azul/25", dot: "bg-azul" },
  rojo: { text: "text-rojo", bg: "bg-rojo/10", border: "border-rojo/25", dot: "bg-rojo" },
  verde: { text: "text-verde", bg: "bg-verde/10", border: "border-verde/25", dot: "bg-verde" },
  gris: { text: "text-gris", bg: "bg-gris/10", border: "border-gris/25", dot: "bg-gris" },
};

export const KPIS: { bucket: BucketKpi; label: string; tono: Tono }[] = [
  { bucket: "pendientes", label: "Pendientes", tono: "ambar" },
  { bucket: "recibidas", label: "Recibidas", tono: "azul" },
  { bucket: "observaciones", label: "Con observaciones", tono: "rojo" },
  { bucket: "validadas", label: "Validadas", tono: "verde" },
];

export function contarPorBucket(estados: EstadoSolicitud[]): Record<BucketKpi, number> {
  const base: Record<BucketKpi, number> = {
    pendientes: 0,
    recibidas: 0,
    observaciones: 0,
    validadas: 0,
  };
  for (const e of estados) base[ESTADO_META[e].bucket] += 1;
  return base;
}
