// =============================================================================
// LÍNEAS DE «SIN HALLAZGO» DEL PASO 3 (encargo 2026-10-26-carga-lectura-primero).
// Sin `server-only`: las usan el servidor (estado-lectura.ts) y la pantalla
// (sugerencia-bloque.tsx).
// =============================================================================

/** Sin hallazgo, con la unidad de la solicitud en la oración (prueba de Esteban en traceline-dev, 26/10). */
export function lineaSinHallazgo(unidad: string | null): string {
  const que = unidad?.trim() ? `una cifra en ${unidad.trim()}` : "la cifra";
  return `No encontramos ${que} en este archivo. Puedes escribir la cifra aquí.`;
}

/** Sin hallazgo con cifras parciales de referencia (sug-num-3). Texto aprobado por Esteban; sin el motivo del modelo. */
export const LINEA_SIN_TOTAL = "El total del periodo no se distingue en el archivo. Las cifras parciales aparecen abajo solo como referencia.";
