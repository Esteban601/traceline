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
  // El párrafo por riesgo es lo que separa una tabla comentada de una revelación
  // (CADU pp. 23-24). Solo se pide cuando el registro trae con qué escribirlo:
  // `se_concentra_en`, `impactos_potenciales` y `respuesta_de_la_emisora`.
  21: "Entre 300 y 500 palabras. Abre con un párrafo breve que diga cuántos riesgos se priorizaron y cómo se clasifican, y sigue con UN PÁRRAFO POR RIESGO que use, de ese registro, `se_concentra_en`, `impactos_potenciales` y `respuesta_de_la_emisora`: dónde pega, qué provocaría y qué hace la Compañía al respecto. No repitas la descripción que ya está en la tabla ni vuelvas a listar sus horizontes. Si un registro no trae esos tres campos, no le dediques párrafo.",
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
