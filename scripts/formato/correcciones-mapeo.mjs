// =============================================================================
// CORRECCIONES DE FILAS DEL MAPEO DEL FORMATO ELECTRÓNICO, aprobadas después de
// la revisión del 13/10. Se aplican al final de mapear-formato.mjs (así una
// regeneración desde el asset no las pierde) y, sobre el JSON versionado, con
// aplicar-correcciones-mapeo.mjs.
//
// Encargo 2026-10-24-deuda-s2-formato, Fase 2: lista de la auditoría mecánica
// del mapeo (scripts/formato/auditar-mapeo.mjs) confirmada por Esteban el 24/10.
// Sin texto del formato (CLAUDE.md §4): cada fila se identifica por su número.
// =============================================================================

const ENCARGO = "2026-10-24 · encargo deuda-s2-formato";
const ENCARGO_VOZ = "2026-10-26 · encargo formato-afirmaciones-y-voz, Fase 2";
const SIN_29B = (inciso) => ({
  capa: "sin candidato", datapoint: null, confianza: "—", bloque: null, alivioE5: false,
  regla: "Con el alivio C4, «No revelado · alivio C4» (regla de la fila 435); sin C4, «Pendiente» hasta ampliar el catálogo",
  nota: `NIIF S2 ${inciso} no existe en el catálogo · deuda de la modificación de 2025 de NIIF S2 (docs/suplemento-s1s2/ampliacion-catalogo.md)`,
});
const SIN_EI25 = {
  capa: "sin candidato", datapoint: null, confianza: "—", bloque: null, alivioE5: false,
  nota: "NIIF S2 EI25 a EI38 (desagregación de las emisiones financiadas por clase de activo) no existe en el catálogo · en la lista de ampliación del catálogo (docs/suplemento-s1s2/ampliacion-catalogo.md)",
};

/** fila → { cambios, motivo }. Los cambios reemplazan esos campos de la fila. */
export const CORRECCIONES = [
  // Fase 3: códigos padre (migración 20261024130000_catalogo_padres_fase3) y síntesis con la regla de K97/K99.
  { fila: 59, motivo: "código padre NIIF S2 13 (a)a(b), con cadena_valor.* (sin modelo_negocio.*, 25/10); deja de repetir K60", cambios: { capa: "3 · revisión (S1→S2)", datapoint: "NIIF S2 13 (a)a(b)", bloque: 13, alivioE5: true, regla: "Modelo, desde el bloque 13 aprobado: código padre NIIF S2 13 (a)a(b), con los hechos de sus incisos y los de cadena_valor.*, sin acciones de respuesta (van en NIIF S2 14) · lleva la oración fija del alivio E5" } },
  { fila: 65, motivo: "código padre NIIF S2 14 (a)(i)a(v): los cinco incisos (bloques 22, 23, 25 y 28)", cambios: { capa: "1 · fuente", datapoint: "NIIF S2 14 (a)(i)a(v)", bloque: 22, alivioE5: true, regla: "Modelo: código padre NIIF S2 14 (a)(i)a(v), con los hechos de sus cinco incisos (bloques 22, 23, 25 y 28) · lleva la oración fija del alivio E5" } },
  { fila: 103, motivo: "código padre NIIF S2 22 (a)a(b), par S2 de NIIF S1 41–42", cambios: { capa: "1 · correspondencia S1→S2", datapoint: "NIIF S2 22 (a)a(b)", bloque: 26, alivioE5: true, regla: "Modelo, desde el bloque 26 aprobado: código padre NIIF S2 22 (a)a(b) · lleva la oración fija del alivio E5" } },
  { fila: 105, motivo: "código padre NIIF S2 22 (a)a(b): reutiliza la síntesis de K103 (misma respuesta, sin la oración E5)", cambios: { capa: "1 · fuente", datapoint: "NIIF S2 22 (a)a(b)", bloque: 26, alivioE5: false, regla: "Modelo, desde el bloque 26 aprobado: código padre NIIF S2 22 (a)a(b), la misma síntesis que la fila 103" } },
  { fila: 62, motivo: "la concentración de registros_clima pasa a esta fila (13(b)), añadida al texto del modelo", cambios: { regla: "Modelo, desde el bloque 13 aprobado y los hechos de NIIF S2 13(b), más la concentración por código desde registros_clima (una línea por riesgo) · lleva la oración fija del alivio E5" } },
  { fila: 64, motivo: "deja la concentración (es de 13(b), fila 62); síntesis de NIIF S2 14 que no repite K65 (decisión (c))", cambios: { bloque: 22, alivioE5: true, regla: "Modelo: síntesis de una o dos oraciones de NIIF S2 14 desde el código padre NIIF S2 14 (a)(i)a(v), sin compartir oraciones con la fila 65 (regla de las filas 97 y 99) · lleva la oración fija del alivio E5" } },
  { fila: 84, motivo: "efectos financieros actuales (S1 34–35 / S2 15–16, no S1 40(a)): síntesis de 16(a) que no repite K85 (decisión (b), según la plantilla)", cambios: { parrafos: ["NIIF S1 34", "NIIF S2 15", "NIIF S2 16 (a)"], capa: "3 · revisión (S1→S2)", datapoint: null, bloque: 10, alivioE5: true, regla: "Modelo, desde el bloque 10 aprobado: síntesis de una o dos oraciones de NIIF S2 16(a), sin compartir oraciones con la fila 85 (regla de las filas 97 y 99) · lleva la oración fija del alivio E5", nota: "la plantilla cita NIIF S1 36-40 en la columna G" } },
  { fila: 91, motivo: "efectos financieros previstos (S1 34–35 / S2 15–16, no S1 40(a)): código padre NIIF S2 16 (b)a(d), según la plantilla (decisión (b))", cambios: { parrafos: ["NIIF S1 34", "NIIF S2 15", "NIIF S2 16 (b)", "NIIF S2 16 (c)", "NIIF S2 16 (d)"], capa: "3 · revisión (S1→S2)", datapoint: "NIIF S2 16 (b)a(d)", bloque: 10, alivioE5: true, regla: "Modelo, desde el bloque 10 aprobado: código padre NIIF S2 16 (b)a(d) · lleva la oración fija del alivio E5", nota: "la plantilla no cita párrafo en las columnas A ni G" } },
  { fila: 100, motivo: "NIIF S2 21(a), alta en el catálogo con dueño el bloque 10", cambios: { capa: "1 · fuente", datapoint: "NIIF S2 21(a)", bloque: 10, alivioE5: true, regla: "Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 21(a) · lleva la oración fija del alivio E5", nota: null } },
  { fila: 329, motivo: "encabezado de Alcance 2 (29(a)(v)), no subconcepto de la fila 327", cambios: { clasificacion: "encabezado", capa: "—", datapoint: null, confianza: "—", bloque: null, alivioE5: false, regla: "Sin respuesta (encabezado)" } },
  { fila: 390, motivo: "entrada de la métrica de oportunidades, NIIF S2 29(d), no 13(a)", cambios: { datapoint: "NIIF S2 29 (d) · B65 (b)", regla: "Párrafo introductorio desde el bloque 36 aprobado (NIIF S2 29(d); la columna A de la fila 391 dice 29(b), errata de la plantilla)" } },
  { fila: 391, motivo: "subconcepto de la fila 390", cambios: { datapoint: "NIIF S2 29 (d) · B65 (b)" } },
  { fila: 392, motivo: "subconcepto de la fila 390", cambios: { datapoint: "NIIF S2 29 (d) · B65 (b)" } },
  { fila: 433, motivo: "NIIF S2 29B, no el Alcance 1 (EI14 a E18)", cambios: SIN_29B("29B") },
  { fila: 437, motivo: "NIIF S2 29B(b), no el Alcance 1 (EI14 a E18)", cambios: SIN_29B("29B(b)") },
  { fila: 462, motivo: "desagregación de las emisiones financiadas por clase de activo (EI25 a EI38), no 29(a)(iv) EI5", cambios: { ...SIN_EI25, regla: "Solo emisoras con gestión de activos (Perfil); si no, «No aplica por actividad». Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo" } },
  { fila: 463, motivo: "subconcepto de la fila 462", cambios: { ...SIN_EI25, regla: "Solo emisoras con gestión de activos (Perfil); si no, «No aplica por actividad». Se responde junto con la fila 462 (text block)" } },
  { fila: 488, motivo: "entrada de la sección de seguros, como la 468 en banca comercial; no NIIF S2 32", cambios: { datapoint: "NIIF S2 29 (a)(vi)(2)", bloque: 33, regla: "Solo emisoras con seguros (Perfil); si no, «No aplica por actividad». Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) (entrada de la sección, como la fila 468)" } },

  // ---------------------------------------------------------------------------
  // Encargo 2026-10-26-formato-afirmaciones-y-voz, Fase 2 (mapeo), con las decisiones D3 y D5 de Esteban.
  // ---------------------------------------------------------------------------
  ...[[45, 44], [418, 417], [426, 425]].map(([fila, bool]) => ({
    fila, encargo: ENCARGO_VOZ, motivo: `«¿Por qué?» del booleano de la fila ${bool}: era subconcepto y quedaba vacía (K45/K697/K705)`,
    cambios: { clasificacion: "concepto", capa: "3 · revisión (regla)", regla: `Si el booleano de la fila ${bool} es «No», la explicación de su respuesta propia (fila:${bool}) sin el «No.» inicial; si es «Sí», vacía` },
  })),
  ...[[420, 417], [428, 425]].map(([fila, bool]) => ({
    fila, encargo: ENCARGO_VOZ, motivo: `«Si ¿Cómo…?» del booleano de la fila ${bool}: solo se despliega con «Sí» (K699/K707 salían con la explicación del «No»)`,
    cambios: { regla: `Modelo, desde el bloque 37 aprobado, SOLO si el booleano de la fila ${bool} es «Sí»; si es «No», vacía (no se despliega)` },
  })),
  { fila: 421, encargo: ENCARGO_VOZ, motivo: "ejemplo de la pregunta de la fila 420, no un concepto (K700 repetía K699)", cambios: { clasificacion: "subconcepto de la fila 420", regla: "Se responde junto con la fila 420 (text block)" } },
  { fila: 432, encargo: ENCARGO_VOZ, motivo: "NIIF S2 29A (K711): concepto, con la regla de 29B (K712–K720)", cambios: { ...SIN_29B("29A"), clasificacion: "concepto" } },
  { fila: 444, encargo: ENCARGO_VOZ, motivo: "¿considerará las métricas por industria? (K723): su propia pregunta, desde metricas_industria (D3)", cambios: { clasificacion: "concepto", capa: "Perfil", perfil: "metricas_industria (D3)", regla: "«Sí» si metricas_industria es «Sí, totalmente» o «Sí, parcialmente»; vacía si es «No» o no está capturado (D3)" } },
  ...[[468, "Banca comercial"], [488, "Seguros"]].map(([fila, actividad]) => ({
    fila, encargo: ENCARGO_VOZ, motivo: `selector de la sección de ${actividad.toLowerCase()} (K${fila + 279}): la actividad, como la fila 339; el alivio C4 va en las filas de datos`,
    cambios: { capa: "Perfil", datapoint: null, bloque: null, perfil: `actividades_financieras (selector: ${actividad})`, regla: `«${actividad}» si la emisora participa en esa actividad (Perfil); si no, «No aplica por actividad»` },
  })),
  ...[582, 587].map((fila) => ({
    fila, encargo: ENCARGO_VOZ, motivo: `NIIF S1 ${fila === 582 ? "B50" : "B54"} (K${fila + 279}): concepto, no miembro de tabla; el primer año no hay comparativos que revisar, como la fila 584`,
    cambios: { clasificacion: "concepto", capa: "regla primer año", regla: "Primer año: «sin mapeo» (no hay importes comparativos que revisar; mismo criterio que la fila 584). Segundo año: desde la revisión de comparativos" },
  })),
  ...[[117, "inicio"], [119, "fin"]].map(([fila, cual]) => ({
    fila, encargo: ENCARGO_VOZ, motivo: `fecha de ${cual} del periodo del análisis de escenarios (K${fila}): una fecha, no una oración (D5)`,
    cambios: { capa: "3 · revisión (regla)", regla: `Fecha de ${cual} del ejercicio (dd/mm/aaaa) si la respuesta de NIIF S2 22(b)(iii) sitúa el análisis en el ejercicio del reporte; si no, pendiente (D5)` },
  })),
  ...[["b", 34, 0], ["c", 35, 23], ["d", 36, 46]].flatMap(([inciso, bloque, d]) => [354, 356, 358, 360, 361].map((f) => ({
    fila: f + d, encargo: ENCARGO_VOZ, motivo: `B65(c), efectos financieros por tipo (NIIF S2 29 (${inciso})): al código de B65(c), no al padre (repetía la exposición)`,
    cambios: { datapoint: `NIIF S2 29 (${inciso}) · B65 (c)`, bloque, regla: `Modelo, desde el bloque ${bloque} aprobado y los hechos de NIIF S2 29 (${inciso}) · B65 (c); el reparto por celda (situación, rendimiento, flujos, previstos, ajuste material) es de la Fase 3` },
  }))),
  ...[365, 388, 411].map((fila) => ({
    fila, encargo: ENCARGO_VOZ, motivo: `B65(e), conexiones con los estados financieros (K${fila + 279}): concepto con dueño el bloque 10, no subconcepto de la enumeración`,
    cambios: { clasificacion: "concepto", capa: "1 · fuente", datapoint: "NIIF S2 B65 inciso (e)", bloque: 10, alivioE5: false, regla: "Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 B65 inciso (e)" },
  })),
];

/** Aplica las correcciones sobre el arreglo de conceptos, en su lugar. Falla si una fila no existe. */
export function aplicarCorrecciones(conceptos) {
  for (const k of CORRECCIONES) {
    const x = conceptos.find((c) => c.fila === k.fila);
    if (!x) throw new Error(`Corrección de la fila ${k.fila}: la fila no está en el mapeo.`);
    Object.assign(x, k.cambios, { correccion: `${k.encargo ?? ENCARGO}: ${k.motivo}` });
  }
  return conceptos;
}
