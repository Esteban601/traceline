import { BLOQUES } from "@/lib/suplemento/bloques";
import { llevaTabla } from "@/lib/suplemento/tablas";

// =============================================================================
// POR DÓNDE SE PRODUCE CADA BLOQUE.
//
// No basta el campo `tipo` de bloques.ts —«D→T», «Tabla + T→E»— porque describe
// la FORMA del resultado, no de dónde sale el contenido. El bloque 4 es
// «Plantilla + T→E» y el 18 «T→E + imagen», y los dos se redactan desde el
// Perfil del emisor; el 8 es «Tabla» y el 9 «D→T + Tabla», y los dos llevan
// tabla armada por código. Lo que decide cómo generar es el ORIGEN:
//
//   · plantilla — texto fijo con variables del reporte y del emisor. No necesita
//     modelo salvo para ajustar la oración condicional de los alivios.
//   · perfil    — lo institucional, que sale de los campos del Perfil del emisor.
//     Si el campo está vacío pero su sección tiene un archivo, el bloque queda
//     'pendiente_adjunto' y lo resuelve A5b.
//   · datos     — de la evidencia del reporte, con o sin tabla armada por código.
//
// Está explícito y no derivado para que se pueda leer de un vistazo qué bloque
// cuesta una llamada al modelo y cuál no.
// =============================================================================

export type Via = "plantilla" | "perfil" | "datos";

const PLANTILLA = [2, 3, 5, 14];
const PERFIL = [1, 4, 7, 11, 12, 18, 19];

export function viaDe(numero: number): Via {
  if (PLANTILLA.includes(numero)) return "plantilla";
  if (PERFIL.includes(numero)) return "perfil";
  return "datos";
}

/** Longitud objetivo por bloque. Con tabla, el texto es más corto. */
const EXTENSION: Record<number, string> = {
  21: "Entre 150 y 300 palabras. La tabla ya lista los riesgos: la prosa explica cómo se identificaron, qué significan los horizontes y qué distingue a los de mayor nivel. No repitas la tabla fila por fila.",
  26: "Entre 250 y 400 palabras. Es el bloque de resiliencia y análisis de escenarios: describe la evaluación, sus áreas de incertidumbre y la capacidad de ajuste, y por separado cómo y cuándo se hizo el análisis, con sus escenarios y supuestos.",
  29: "Entre 120 y 250 palabras. La tabla ya da las cifras: tu prosa la introduce, dice qué comprende cada alcance y comenta lo que la tabla no puede decir. No repitas los números.",
};

export function extensionDe(numero: number): string {
  const propia = EXTENSION[numero];
  if (propia) return propia;
  return llevaTabla(numero)
    ? "Entre 120 y 250 palabras. La tabla ya da las cifras: introdúcela y comenta lo que no puede decir, sin repetir los números."
    : "Entre 200 y 350 palabras. Un párrafo de encuadre y luego el detalle.";
}

/** Índice de los 40 bloques con su vía, para el log y la vista de revisión. */
export function resumenDeVias(): { numero: number; titulo: string; via: Via; tabla: boolean }[] {
  return BLOQUES.map((b) => ({
    numero: b.numero,
    titulo: b.titulo,
    via: viaDe(b.numero),
    tabla: llevaTabla(b.numero),
  }));
}
