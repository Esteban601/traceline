// =============================================================================
// Opciones canónicas de los objetivos (estructura oficial de la taxonomía,
// hoja índice). Compartidas por la vista (controles) y la server action (validación),
// para que ambas hablen exactamente el mismo vocabulario.
// =============================================================================

export const SEP_OBJ = "; ";

// `tipo` (S2 33 / S1 51) — enumeración de valor único condicionada por ámbito:
//   climático     → las 3 opciones; sostenibilidad → solo las dos primeras.
export const TIPO_POR_AMBITO: Record<"climatico" | "sostenibilidad", string[]> = {
  climatico: [
    "Fijado por la entidad",
    "Fijado por ley o regulación",
    "Objetivo de emisiones de gases de efecto invernadero",
  ],
  sostenibilidad: ["Fijado por la entidad", "Fijado por ley o regulación"],
};

export function tiposDe(ambito: string): string[] {
  return TIPO_POR_AMBITO[ambito as "climatico" | "sostenibilidad"] ?? [];
}

// `tipo_objetivo` (S2 33) — enumeración de valor único.
export const TIPOS_OBJETIVO = ["Cuantitativo", "Absoluto", "De intensidad"];

// S2 36 (a) — gases cubiertos (multi-enum, 7 gases oficiales verbatim).
export const GASES = [
  "Dióxido de carbono (CO2)",
  "Metano (CH4)",
  "Óxido nitroso (N2O)",
  "Hidrofluorocarburos (HFC)",
  "Perfluorocarburos (PFC)",
  "Hexafluoruro de azufre (SF6)",
  "Trifluoruro de nitrógeno (NF3)",
];

// S2 36 (b) — alcances cubiertos (multi-enum).
export const ALCANCES = ["Alcance 1", "Alcance 2", "Alcance 3"];

// S2 36 (c) — bruto/neto (enumeración de valor único).
export const BRUTO_NETO = [
  "Emisiones brutas de gases de efecto invernadero",
  "Emisiones netas de gases de efecto invernadero",
];

// Booleanos legibles (S2 34 validación por tercero, S2 36 (d) enfoque sectorial).
export const BOOLEANO_OBJ = ["Verdadero", "Falso"];

/** Serializa un multi-enum en el orden canónico dado. */
export function serializarMulti(seleccion: string[], canon: string[]): string {
  const set = new Set(seleccion);
  return canon.filter((o) => set.has(o)).join(SEP_OBJ);
}

/** Parsea un multi-enum serializado a array (tolerante a espacios). */
export function parsearMulti(valor: string | null | undefined): string[] {
  return (valor ?? "")
    .split(SEP_OBJ)
    .map((s) => s.trim())
    .filter(Boolean);
}
