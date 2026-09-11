// =============================================================================
// MODELOS Y PRECIOS — la tabla con la que se calcula lo que cuesta un bloque.
//
// VERIFICADA CONTRA LA FUENTE EL 11 DE SEPTIEMBRE DE 2026, no escrita de
// memoria: platform.claude.com/docs/en/about-claude/pricing y
// .../about-claude/models/overview. Los precios cambian; esta constante lleva
// fecha para que se note cuándo dejó de ser cierta.
//
// POR QUÉ ESTÁ AQUÍ Y NO EN LA LLAMADA. El costo se guarda por bloque en
// `documentos_bloques.costo_usd` y se suma por documento. Si el cálculo viviera
// donde se llama al modelo, cada consumidor tendría su propia versión de los
// multiplicadores de caché, que son la parte que se equivoca.
// =============================================================================

/** Tarifas en dólares por millón de tokens. */
export type Tarifa = {
  entrada: number;
  /** Escritura al caché con TTL de 5 minutos: 1.25x la entrada base. */
  cacheEscritura5m: number;
  /** Lectura desde el caché. 0.1x la entrada base — salvo Fable 5.1, que es 0.025x. */
  cacheLectura: number;
  salida: number;
};

export type ClaveModelo = keyof typeof MODELOS;

export const PRECIOS_VERIFICADOS_EL = "2026-09-11";

export const MODELOS = {
  "claude-fable-5-1": {
    etiqueta: "Claude Fable 5.1",
    nivel: "mayor" as const,
    tarifa: { entrada: 10, cacheEscritura5m: 12.5, cacheLectura: 0.25, salida: 50 },
  },
  "claude-opus-5": {
    etiqueta: "Claude Opus 5",
    nivel: "alto" as const,
    tarifa: { entrada: 5, cacheEscritura5m: 6.25, cacheLectura: 0.5, salida: 25 },
  },
  "claude-sonnet-5": {
    etiqueta: "Claude Sonnet 5",
    nivel: "intermedio" as const,
    tarifa: { entrada: 2, cacheEscritura5m: 2.5, cacheLectura: 0.2, salida: 10 },
  },
  "claude-haiku-4-5": {
    etiqueta: "Claude Haiku 4.5",
    nivel: "rapido" as const,
    tarifa: { entrada: 1, cacheEscritura5m: 1.25, cacheLectura: 0.1, salida: 5 },
  },
} satisfies Record<string, { etiqueta: string; nivel: string; tarifa: Tarifa }>;

/**
 * MODELO POR TIPO DE BLOQUE, decidido en A4 sobre el bloque 29 con datos reales.
 *
 * Fable 5.1 para lo que hay que RAZONAR: un bloque D→T tiene que decidir qué
 * dice una cifra, qué se calla por un alivio y dónde falta un dato. Ahí Sonnet 5
 * fue correcto pero se dejó cosas: no detectó que el Alcance 2 llegó sin
 * desagregar entre ubicación y mercado, y metió los ids de las fuentes dentro de
 * la prosa —en un documento firmado eso no puede aparecer—.
 *
 * Sonnet 5 para lo que hay que REDACTAR sobre un guion ya fijo: los bloques de
 * plantilla, las frases que introducen una tabla que armó el código, y la
 * normalización de estilo. Ahí no hay juicio que tomar y cuesta seis veces menos
 * ($0.0279 contra $0.1719 en la misma llamada).
 */
export const MODELO_POR_TIPO: Record<string, ClaveModelo> = {
  "D→T": "claude-fable-5-1",
  "T→E": "claude-fable-5-1",
  "D→T + Tabla": "claude-fable-5-1",
  "Tabla + D→T": "claude-fable-5-1",
  "Tabla + T→E": "claude-fable-5-1",
  "T→E + imagen": "claude-fable-5-1",
  "Plantilla + T→E": "claude-fable-5-1",
  Plantilla: "claude-sonnet-5",
  Tabla: "claude-sonnet-5",
};

/** Cuando el tipo no está en la tabla, manda el de mayor capacidad. */
export const MODELO_POR_DEFECTO: ClaveModelo = "claude-fable-5-1";

export function modeloDeTipo(tipo: string): ClaveModelo {
  return MODELO_POR_TIPO[tipo] ?? MODELO_POR_DEFECTO;
}

// -----------------------------------------------------------------------------
// ESFUERZO DE RAZONAMIENTO, POR TIPO DE BLOQUE.
//
// Verificado el 11 de septiembre de 2026 contra
// platform.claude.com/docs/en/build-with-claude/effort:
//
//   · Fable 5.1 acepta `output_config.effort` con cinco niveles: low, medium,
//     high, xhigh y max. El valor por defecto es `high`, y pasar "high"
//     explícitamente es idéntico a omitirlo.
//   · El esfuerzo afecta a TODOS los tokens de salida, incluido el razonamiento.
//     En A4, la salida del bloque 29 fueron 4 666 tokens para 1 245 caracteres de
//     texto: casi todo es razonamiento, y es donde está el costo.
//   · CAMBIAR EL ESFUERZO INVALIDA EL CACHÉ DE PROMPT. Los cuarenta bloques
//     comparten prefijo —reglas, ejemplo, índice, emisora— y ese prefijo se
//     cachea entre bloques. Si el esfuerzo varía por tipo, cada nivel mantiene su
//     propia copia del prefijo: con dos niveles se paga la escritura dos veces
//     por documento, no cuarenta. Es asumible, pero hay que saberlo antes de
//     mover estos valores.
//   · Existe un cambio de esfuerzo POR MENSAJE que sí conserva el caché
//     (beta `mid-conversation-output-config-2026-07-01`), pero es para variar el
//     nivel dentro de una conversación. Aquí cada bloque es una llamada de un
//     solo turno, así que no aplica.
//
// SE DEJA TODO EN `high`, que es el valor por defecto: la tabla existe para poder
// medir el barrido de esfuerzo sobre los mismos bloques, no para adivinar ahora
// cuál conviene. Bajar a `medium` los bloques de plantilla es la primera prueba
// que vale la pena hacer.
// -----------------------------------------------------------------------------
export type Esfuerzo = "low" | "medium" | "high" | "xhigh" | "max";

export const ESFUERZO_POR_TIPO: Record<string, Esfuerzo> = {
  "D→T": "high",
  "T→E": "high",
  "D→T + Tabla": "high",
  "Tabla + D→T": "high",
  "Tabla + T→E": "high",
  "T→E + imagen": "high",
  "Plantilla + T→E": "high",
  Plantilla: "high",
  Tabla: "high",
};

export const ESFUERZO_POR_DEFECTO: Esfuerzo = "high";

export function esfuerzoDeTipo(tipo: string): Esfuerzo {
  return ESFUERZO_POR_TIPO[tipo] ?? ESFUERZO_POR_DEFECTO;
}

export type Uso = {
  /** Tokens de entrada NO cacheados. */
  entrada: number;
  cacheEscritura: number;
  cacheLectura: number;
  salida: number;
};

/**
 * Costo en dólares de una llamada. Las cuatro cantidades se cobran a precios
 * distintos: sumarlas antes de multiplicar —el error fácil— infla el costo de
 * una llamada con caché caliente por un factor de diez.
 */
export function costoUsd(modelo: ClaveModelo, uso: Uso): number {
  const t = MODELOS[modelo].tarifa;
  const total =
    (uso.entrada * t.entrada +
      uso.cacheEscritura * t.cacheEscritura5m +
      uso.cacheLectura * t.cacheLectura +
      uso.salida * t.salida) /
    1_000_000;
  // La columna es numeric(10,4): redondear aquí evita que la base lo haga con
  // otro criterio y que el total del documento no cuadre con la suma de bloques.
  return Math.round(total * 10_000) / 10_000;
}

export function esModeloConocido(m: string): m is ClaveModelo {
  return Object.hasOwn(MODELOS, m);
}
