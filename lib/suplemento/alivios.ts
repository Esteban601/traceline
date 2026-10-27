import type { Alivios } from "@/lib/perfil-emisor";

// =============================================================================
// TEXTOS DE LOS ALIVIOS DE TRANSICIÓN. ÚNICA FUENTE (decisión de Esteban, Fase 5
// del encargo formato-afirmaciones-y-voz).
//
// Los usan el generador de respuestas, el Formato electrónico y el Excel de
// taxonomía; ninguno escribe su propia redacción. Es la del Formato electrónico,
// en tres formas:
//   · encabezado: la oración del alivio E5, una vez por encabezado de pilar;
//   · requisito: lo que dice un requisito que el alivio deja sin respuesta propia
//     (E5: la remisión a su par de NIIF S2, o la oración si no tiene par; C4: «No
//     revelado · alivio C4», porque Alcance 3 aplica y se difiere, no «No aplica»);
//   · cifra: la celda de un dato que el alivio deja fuera («No revelado · alivio
//     C3» en el comparativo, «No revelado · alivio C4» en Alcance 3).
// Redacción de la casa; no reproduce la norma.
// =============================================================================

export type Alivio = "E5" | "C3" | "C4";

/** Oración fija del alivio E5 (forma «encabezado»). */
export const ORACION_E5 =
  "En este primer periodo anual de aplicación, la Compañía se acoge a la exención del párrafo E5 de la NIIF S1 y revela únicamente información sobre los riesgos y oportunidades relacionados con el clima.";

/** El alcance del cumplimiento con el alivio E5, para la declaración de NIIF S1 72. */
export const ALCANCE_E5 =
  "En este primer periodo anual de aplicación, el cumplimiento comprende la información sobre los riesgos y oportunidades relacionados con el clima, en el alcance que permite la exención del párrafo E5 de la NIIF S1.";
/** El E4 en la declaración de NIIF S1 72, después del alcance del E5: «En este primer periodo…» una sola vez (Esteban, Fase 3). */
export const E4_EN_DECLARACION =
  "Asimismo, se acoge a la exención del párrafo E4 de la NIIF S1 y publica su información financiera relacionada con la sostenibilidad después de sus estados financieros.";
/** Oración fija del alivio E4: va en la respuesta de la declaración de cumplimiento del Excel si no la trae. */
export const ORACION_E4 =
  "En este primer periodo anual de aplicación, la Compañía se acoge a la exención del párrafo E4 de la NIIF S1 y publica su información financiera relacionada con la sostenibilidad después de sus estados financieros.";

/** Forma «cifra» (y «requisito» de C3/C4): la celda que el alivio deja fuera. */
export const noRevelado = (alivio: Alivio) => `No revelado · alivio ${alivio}`;

/** Forma «requisito» de E5: la remisión al par de NIIF S2, sin la oración del alivio (que va en el encabezado). */
export const remisionE5 = (parS2: string) =>
  `La información correspondiente a este requisito, en lo relativo al clima, se revela conforme a ${parS2}.`;

/**
 * El texto de un alivio en una de sus tres formas. «encabezado» solo existe para E5. En «requisito», E5 lleva la
 * remisión a su par (o la oración si no tiene) y C3/C4 lo mismo que su cifra.
 */
export function textoAlivio(alivio: Alivio, forma: "encabezado" | "requisito" | "cifra", parS2?: string | null): string {
  if (alivio === "E5") return forma === "requisito" && parS2 ? remisionE5(parS2) : ORACION_E5;
  return noRevelado(alivio);
}

/** Los alivios del reporte, en la celda K12 del Formato electrónico (antes en su hoja «Leyenda»). */
export function declaracionDeAlivios(alivios: Alivios): string {
  const s1 = (["E4", "E5"] as const).filter((a) => alivios[a]);
  const s2 = (["C3", "C4"] as const).filter((a) => alivios[a]);
  const y = (xs: readonly string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs[0]);
  const partes = [s1.length ? `NIIF S1 ${y(s1)}` : null, s2.length ? `NIIF S2 ${y(s2)}` : null].filter(Boolean);
  return partes.length ? `Alivios de transición aplicados en este ejercicio: ${partes.join("; ")}.` : "Sin alivios de transición en este ejercicio.";
}
