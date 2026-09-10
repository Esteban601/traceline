// =============================================================================
// PERFIL DEL EMISOR — formas de sus campos jsonb y cálculo del nivel de riesgo.
//
// Data pura, sin `server-only`: lo comparten la página del panel, la vista
// cliente, las server actions y (en A5) el generador del suplemento. Las listas
// se guardan como jsonb porque son cortas, ordenadas y siempre se leen enteras
// junto a su perfil; lo que NO se hace es enseñárselas al usuario como JSON —se
// editan como filas—, y este módulo es lo que traduce entre ambas cosas.
// =============================================================================

export type Horizonte = {
  /** "Corto plazo" | "Mediano plazo" | "Largo plazo". Fijos: son los de NIIF S2 10. */
  plazo: string;
  definicion: string;
  justificacion: string;
};

export type Hito = { anio: string; texto: string };
export type EtapaCadena = { etapa: string; descripcion: string };

export type NivelMatriz = {
  nombre: string;
  /** Rango cerrado [min, max] del puntaje de severidad. */
  min: number;
  max: number;
};

export type MatrizRiesgos = {
  escala_max: number;
  niveles: NivelMatriz[];
};

/** Los tres horizontes de NIIF S2 10. El orden y los nombres no se editan. */
export const PLAZOS: readonly string[] = ["Corto plazo", "Mediano plazo", "Largo plazo"];

/**
 * Matriz SUGERIDA, no impuesta: es la que usa CADU (probabilidad × impacto en
 * escala 1–5, puntaje 0–25, cuatro niveles). Se ofrece como punto de partida
 * porque partir de una hoja en blanco es lo que hace que nadie llene el campo;
 * cualquier emisora puede cambiar los cortes, los nombres o el número de niveles.
 */
export const MATRIZ_SUGERIDA: MatrizRiesgos = {
  escala_max: 25,
  niveles: [
    { nombre: "Crítico", min: 20, max: 25 },
    { nombre: "Alto", min: 12, max: 19 },
    { nombre: "Medio", min: 6, max: 11 },
    { nombre: "Bajo", min: 0, max: 5 },
  ],
};

export function matrizVacia(m: MatrizRiesgos | null | undefined): boolean {
  return !m || !Array.isArray(m.niveles) || m.niveles.length === 0;
}

/**
 * Traduce un puntaje de severidad al nivel de la matriz de ESA emisora.
 *
 * Devuelve null cuando no hay puntaje o cuando la emisora no ha definido su
 * matriz: en ese caso el nivel se queda vacío y la UI lo dice con un enlace al
 * perfil. Inventar un nivel con una escala que el cliente no declaró sería
 * exactamente el tipo de dato fabricado que este proyecto no admite.
 */
export function nivelDeSeveridad(
  severidad: number | null | undefined,
  matriz: MatrizRiesgos | null | undefined
): string | null {
  if (severidad == null || !Number.isFinite(severidad)) return null;
  if (matrizVacia(matriz)) return null;
  // De mayor a menor: si dos rangos se solapan por un error de captura, gana el
  // más severo. Es el lado seguro para una tabla de priorización.
  const ordenados = [...matriz!.niveles].sort((a, b) => b.min - a.min);
  for (const n of ordenados) {
    if (severidad >= n.min && severidad <= n.max) return n.nombre;
  }
  return null;
}

/**
 * Severidad efectiva: el producto de los factores cuando están los dos, o el
 * puntaje capturado a mano cuando el cliente solo entrega ese. §5 de la
 * especificación admite las dos formas a propósito.
 */
export function severidadEfectiva(
  probabilidad: number | null | undefined,
  impacto: number | null | undefined,
  severidadCapturada: number | null | undefined
): number | null {
  if (probabilidad != null && impacto != null) return probabilidad * impacto;
  return severidadCapturada ?? null;
}

// -----------------------------------------------------------------------------
// Lecturas defensivas de jsonb. La base garantiza que es un arreglo o un objeto
// (los CHECK de la migración), no que sus elementos tengan forma: una fila
// escrita por una versión anterior del formulario no debe romper la pantalla.
// -----------------------------------------------------------------------------
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function leerHorizontes(raw: unknown): Horizonte[] {
  const filas = Array.isArray(raw) ? raw : [];
  // Siempre las tres, en orden: son fijas y el formulario las pinta como tales.
  return PLAZOS.map((plazo) => {
    const f = filas.find(
      (x) => x && typeof x === "object" && str((x as Record<string, unknown>).plazo) === plazo
    ) as Record<string, unknown> | undefined;
    return {
      plazo,
      definicion: str(f?.definicion),
      justificacion: str(f?.justificacion),
    };
  });
}

export function leerHitos(raw: unknown): Hito[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const o = x as Record<string, unknown>;
      return { anio: str(o.anio), texto: str(o.texto) };
    });
}

export function leerCadena(raw: unknown): EtapaCadena[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const o = x as Record<string, unknown>;
      return { etapa: str(o.etapa), descripcion: str(o.descripcion) };
    });
}

export function leerMatriz(raw: unknown): MatrizRiesgos | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.niveles) || o.niveles.length === 0) return null;
  return {
    escala_max: num(o.escala_max) || 25,
    niveles: (o.niveles as unknown[])
      .filter((x) => x && typeof x === "object")
      .map((x) => {
        const n = x as Record<string, unknown>;
        return { nombre: str(n.nombre), min: num(n.min), max: num(n.max) };
      }),
  };
}

// -----------------------------------------------------------------------------
// Alivios transitorios (reportes.alivios) y régimen del ejercicio (§3.1)
// -----------------------------------------------------------------------------
export type ClaveAlivio = "E4" | "E5" | "C3" | "C4" | "C5";

export const ALIVIOS: { clave: ClaveAlivio; titulo: string; ayuda: string }[] = [
  {
    clave: "E4",
    titulo: "NIIF S1 E4 — Momento de la información",
    ayuda:
      "Permite publicar la información de sostenibilidad después de los estados financieros en el primer ejercicio, en vez de simultáneamente.",
  },
  {
    clave: "E5",
    titulo: "NIIF S1 E5 — Solo clima el primer año",
    ayuda:
      "El primer ejercicio se informa únicamente sobre riesgos y oportunidades climáticos. Los datapoints de S1 general no aplican todavía.",
  },
  {
    clave: "C3",
    titulo: "NIIF S2 C3 — Sin comparativos",
    ayuda:
      "Exime de presentar la columna del ejercicio anterior en el primer año de aplicación.",
  },
  {
    clave: "C4",
    titulo: "NIIF S2 C4 — Sin Alcance 3",
    ayuda:
      "Exime de revelar las emisiones de Alcance 3 en el primer ejercicio, incluidas las categorías.",
  },
  {
    clave: "C5",
    titulo: "NIIF S2 C5 — Método de medición previo",
    ayuda:
      "Permite conservar el método de medición de GEI que la entidad ya usaba, en lugar del Protocolo GEI, durante el primer ejercicio.",
  },
];

export type Alivios = Partial<Record<ClaveAlivio, boolean>>;

export function leerAlivios(raw: unknown): Alivios {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Alivios = {};
  for (const { clave } of ALIVIOS) if (o[clave] === true) out[clave] = true;
  return out;
}

export type Regimen = "primer_anio" | "subsecuentes" | "indeterminado";

/**
 * Régimen del ejercicio. Sin año de adopción declarado no se adivina: se dice
 * "indeterminado" y la UI pide el dato, porque de esto depende si medio
 * documento sale con comparativos o sin ellos.
 */
export function regimenDe(
  ejercicio: number,
  anioAdopcion: number | null | undefined
): Regimen {
  if (anioAdopcion == null) return "indeterminado";
  return ejercicio <= anioAdopcion ? "primer_anio" : "subsecuentes";
}

export const REGIMEN_LABEL: Record<Regimen, string> = {
  primer_anio: "Primer año de adopción",
  subsecuentes: "Año subsecuente",
  indeterminado: "Sin año de adopción declarado",
};
