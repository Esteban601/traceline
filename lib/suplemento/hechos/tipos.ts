// =============================================================================
// LIBRO DE HECHOS — tipos compartidos (encargo suplemento-calidad, Paso 5).
// =============================================================================

export type RangoFuente = "validado" | "perfil" | "adjunto";
export type FuenteTipo = "captura" | "extracto" | "cuestionario" | "perfil" | "registro" | "objetivo" | "adjunto";
export type TipoHecho = "cifra" | "fecha" | "nombre" | "frecuencia" | "responsable" | "composicion" | "proceso" | "politica" | "otro";

export const TIPOS_HECHO: TipoHecho[] = ["cifra", "fecha", "nombre", "frecuencia", "responsable", "composicion", "proceso", "politica", "otro"];

/** Jerarquía: un número menor manda. */
export const ORDEN_RANGO: Record<RangoFuente, number> = { validado: 0, perfil: 1, adjunto: 2 };

/** Un hecho antes de guardarse. */
export type HechoNuevo = {
  clave: string;
  enunciado: string;
  tipo: TipoHecho;
  valor: number | null;
  unidad: string | null;
  periodo: string | null;
  rango_fuente: RangoFuente;
  fuente_tipo: FuenteTipo;
  fuente_id: string;
  fuente_detalle: string;
  extracto: string;
  verificado: boolean;
  verificacion: string;
  bloque_dueno: number | null;
  bloques_referencia: number[];
  estado: "vigente" | "en_conflicto" | "descartado";
  grupo_conflicto?: string | null;
  conflicto?: string | null;
};

/**
 * Un tramo de texto que el modelo atomiza en hechos: una respuesta de
 * cuestionario, un extracto confirmado, un campo de texto del Perfil, una página
 * o un tramo de párrafos de un adjunto. `id` es el id citable de la fuente.
 */
export type UnidadTexto = {
  id: string;
  rango: RangoFuente;
  fuenteTipo: FuenteTipo;
  detalle: string;
  texto: string;
  /** Bloques que, por la fuente, probablemente lo usan. Pista para el modelo, no restricción. */
  sugeridos: number[];
};

