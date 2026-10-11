// =============================================================================
// LIBRO DE HECHOS — tipos compartidos (encargo suplemento-calidad, Paso 5).
// =============================================================================

/** «narrativo»: Carta de la Dirección y textos editoriales; no sostienen una afirmación solos (Paso 5b). */
export type RangoFuente = "validado" | "perfil" | "adjunto" | "narrativo";
export type FuenteTipo = "captura" | "extracto" | "cuestionario" | "perfil" | "registro" | "objetivo" | "adjunto";
/** «tramite»: acuerdo de trámite de un acta (solicitar un informe, designar delegados, aprobar el orden del día); no se publica (Paso 5c). */
/** «declaracion_negativa»: la emisora declara una ausencia («no usa créditos de carbono», «ninguna revisión en 2025»); responde un requisito y no se omite (añadido 12). */
export type TipoHecho = "cifra" | "fecha" | "nombre" | "frecuencia" | "responsable" | "composicion" | "proceso" | "politica" | "otro" | "tramite" | "declaracion_negativa";

export const TIPOS_HECHO: TipoHecho[] = ["cifra", "fecha", "nombre", "frecuencia", "responsable", "composicion", "proceso", "politica", "otro", "tramite", "declaracion_negativa"];

/**
 * Una oración que declara una ausencia. La decide el código —no el modelo— para
 * que sea estable entre corridas.
 */
export const NEGACION =
  /(?<!\p{L})(?:no\s+(?:existen?|hay|hubo|hace\s+uso|hacen\s+uso|usa|usan|utiliza|utilizan|prevé|preve|aplica|se\s+(?:realiz\w+|registr\w+|revis\w+|aplic\w+|identific\w+|cuantific\w+|basa))|ningun[oa]?|ningún|sin\s+(?:cambios|revisi\w+|compensaciones))(?!\p{L})/iu;

/** Jerarquía: un número menor manda. */
export const ORDEN_RANGO: Record<RangoFuente, number> = { validado: 0, perfil: 1, adjunto: 2, narrativo: 3 };

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
  /** Libro estable (Paso 5b): la oración de la fuente, su alcance y la decisión sobre su grupo. */
  oracion?: string | null;
  alcance?: "clima" | "entidad" | "sostenibilidad_general" | "generico" | null;
  veredicto?: "excluyente" | "compatible" | "secuencia" | "por_conciliar" | null;
  conciliacion?: string | null;
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
  /** El texto viene en líneas de página de PDF: al partir en oraciones se rehacen los párrafos. */
  pdf?: boolean;
};

