// =============================================================================
// MARCOS DEL CATÁLOGO: NIIF, GRI y SASB (encargo 2026-10-31-catalogo-gri-sasb).
//
// NIIF es la taxonomía oficial S1/S2: la única que cuenta en el avance y la única de la plantilla oficial. GRI y
// SASB cuentan aparte (Cobertura) y van en su propio libro (export-gri-sasb). Una fila SASB solo aplica a la
// emisora cuya industria está en su Perfil (`perfil_emisor.sector_sasb`, con la etiqueta del Formato electrónico:
// «[815200] Finanzas - Bancos comerciales (FN-CB)»). Sin emisora seleccionada (agregado de la firma) se muestran
// todas.
//
// Sin "server-only": lo usan el tablero (cliente), el informe y las rutas de exportación (servidor).
// =============================================================================

export type Marco = "NIIF" | "GRI" | "SASB";

/** Industrias SASB del sector del Perfil: el código entre paréntesis de cada etiqueta (p. ej. «FN-CB»). */
export function industriasSasb(sector: readonly string[] | null | undefined): Set<string> {
  return new Set((sector ?? []).map((s) => s.match(/\(([A-Z]{2}-[A-Z]{2})\)\s*$/)?.[1]).filter((x): x is string => !!x));
}

/** La industria de una fila SASB, por su estándar («SASB FN-CB» → «FN-CB»). */
export function industriaDe(estandar: string | null | undefined): string | null {
  return estandar?.match(/^SASB ([A-Z]{2}-[A-Z]{2})$/)?.[1] ?? null;
}

/**
 * Si un datapoint aplica a la emisora: NIIF y GRI, siempre; SASB, solo si su industria está en el sector del Perfil.
 * `industrias` nulo = sin emisora seleccionada: aplican todos.
 */
export function aplicaAEmisora(d: { marco: string; estandar?: string | null }, industrias: Set<string> | null): boolean {
  if (d.marco !== "SASB" || industrias === null) return true;
  const ind = industriaDe(d.estandar);
  return !!ind && industrias.has(ind);
}
