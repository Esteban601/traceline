// =============================================================================
// MAPEO BLOQUE → FUENTES del Suplemento NIIF S1/S2 (§3 de la especificación).
//
// GENERADO Y VERIFICADO CONTRA EL CATÁLOGO. Los códigos de `datapoints` se
// resolvieron uno a uno contra `datapoints_taxonomia.codigo` en traceline-dev y
// se emiten VERBATIM. No se escriben a mano por una razón concreta: el catálogo
// tiene espaciado irregular —"NIIF S2 6 (a)(i)" lleva espacio y "NIIF S2 6(b)" no,
// "NIIF S2 25 (a)(i)a(v)" mezcla ambos— así que un código tecleado de memoria no
// empata por igualdad de cadena y el bloque se queda sin su requisito en silencio.
//
// `validarMapeo()` vuelve a comprobarlo en arranque contra la base viva: si
// alguien edita el catálogo, el servidor lo dice en vez de generar un documento
// al que le falta un requisito.
//
// UN BLOQUE SIN CÓDIGOS NO ES UN ERROR. Cerca de un tercio del suplemento es
// institucional (carta, historia, modelo de negocio) y su fuente es el perfil del
// emisor o una plantilla; esos bloques declaran `datapoints: []` y llenan
// `perfil` o `tablas`.
// =============================================================================

import type { Alivios, ClaveAlivio } from "@/lib/perfil-emisor";

/** Cómo se produce el texto del bloque. */
export type TipoBloque =
  | "D→T"
  | "T→E"
  | "Tabla"
  | "Plantilla"
  | "Plantilla + T→E"
  | "D→T + Tabla"
  | "Tabla + D→T"
  | "Tabla + T→E"
  | "T→E + imagen";

/**
 * Régimen del ejercicio (§3.1). "varia_por_regimen" = el bloque cambia de forma
 * entre el primer año de adopción y los subsecuentes (comparativos, Alcance 3,
 * alivios); "ambos" = se genera igual en los dos.
 */
export type RegimenBloque = "ambos" | "varia_por_regimen";

/**
 * Clase del bloque (encargo suplemento-calidad, Paso 0, aprobado con ajustes):
 *   · normativo             — lo exige un párrafo de NIIF S1 o S2 (`respaldo`). Siempre va.
 *   · editorial_recomendado — no lo exige la norma; va ENCENDIDO por defecto.
 *   · editorial_opcional    — no lo exige la norma; va APAGADO por defecto.
 * La selección de editoriales se guarda en el documento (editoriales_incluidos).
 */
export type ClaseBloque = "normativo" | "editorial_recomendado" | "editorial_opcional";

export type Bloque = {
  /** Clave estable. Sobrevive a una renumeración de §3; es lo que persiste documentos_bloques.clave. */
  clave: string;
  /** Número en §3 (1..40). */
  numero: number;
  seccion: string;
  titulo: string;
  tipo: TipoBloque;
  regimen: RegimenBloque;
  /** Códigos EXACTOS de datapoints_taxonomia.codigo. Vacío = el bloque no sale de la taxonomía. */
  datapoints: string[];
  /** Tablas del esquema que lo alimentan. */
  tablas: string[];
  /** Campos de perfil_emisor que lo alimentan. */
  perfil: string[];
  clase: ClaseBloque;
  /** Normativo: el párrafo que lo exige. Editorial: por qué no lo exige ninguno. */
  respaldo: string;
};

// -----------------------------------------------------------------------------
// QUÉ DEJA DE SER EXIGIBLE CUANDO UN ALIVIO ESTÁ ACTIVO.
//
// Es GLOBAL y no por bloque porque el alivio lo es: C4 exime el Alcance 3 en
// todo el documento, no solo donde se enumeran las emisiones. Antes de esto, el
// bloque 29 recibía el requisito de desagregación de Alcance 3 y lo marcaba como
// pendiente, cuando bajo C4 sencillamente no aplica: el revisor veía un hueco
// donde no lo había, y la tabla incluía una fila que la emisora había decidido
// no revelar.
//
// `prefijosRubro` es lo que filtra los DATOS, no solo los requisitos: una
// solicitud de Alcance 3 puede estar ligada además a un datapoint que sí aplica
// —el total de emisiones brutas—, así que excluir por código no basta para que
// su cifra no aparezca en la tabla.
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// CUANDO UN REQUISITO NO SALE DE UNA SOLICITUD SINO DEL PERFIL.
//
// Algunos requisitos de la norma los contesta un campo institucional que ya se
// captura una sola vez y se conserva entre ejercicios. NIIF S2 10(d) —sobre qué
// horizontes de corto, mediano y largo plazo se evaluaron los efectos, y por qué
// esos— es exactamente el contenido de `perfil.horizontes`, capturado en el
// bloque 8. Pedirlo además como solicitud le exigía a la emisora entregar dos
// veces lo mismo, y el bloque 21 abría un pendiente por un dato que el documento
// ya trae escrito unas páginas antes.
//
// Con la fuente alternativa presente el requisito cuenta como CUBIERTO y el
// bloque remite al que lo desarrolla, en vez de repetirlo.
// -----------------------------------------------------------------------------
export const FUENTES_ALTERNATIVAS: Record<
  string,
  { campos: string[]; remitirA: number }
> = {
  "NIIF S2 10(d)": { campos: ["horizontes"], remitirA: 8 },
};

export const CONDICIONADOS_POR_ALIVIO: Partial<
  Record<ClaveAlivio, { datapoints: string[]; prefijosRubro: string[] }>
> = {
  // C4 — el primer ejercicio no revela emisiones de Alcance 3, ni su total, ni
  // sus categorías, ni la desagregación por gases de ninguna de ellas.
  C4: {
    datapoints: [
      "NIIF S2 EI19 a EI24",
      "NIIF S2 29 (a)(vi)(1)",
      "NIIF S2 29 (a)(vi)(1) EI12",
      "NIIF S2 29 (a)(vi)(2)",
    ],
    prefijosRubro: ["gei_alcance_3", "gei_a3_"],
  },
};

/** Códigos que un conjunto de alivios vigentes deja fuera. */
export function datapointsExentos(alivios: Alivios): Set<string> {
  const fuera = new Set<string>();
  for (const [clave, reglas] of Object.entries(CONDICIONADOS_POR_ALIVIO)) {
    if (!alivios[clave as ClaveAlivio]) continue;
    for (const d of reglas.datapoints) fuera.add(d);
  }
  return fuera;
}

/** ¿El dato de este rubro se calla por algún alivio vigente? */
export function rubroExento(rubro: string | null, alivios: Alivios): boolean {
  if (!rubro) return false;
  for (const [clave, reglas] of Object.entries(CONDICIONADOS_POR_ALIVIO)) {
    if (!alivios[clave as ClaveAlivio]) continue;
    if (reglas.prefijosRubro.some((p) => rubro.startsWith(p))) return true;
  }
  return false;
}

export const BLOQUES: Bloque[] = [
  {
    clave: "carta_direccion",
    numero: 1,
    seccion: "I · Introducción",
    titulo: "Carta de la Dirección",
    clase: "editorial_opcional",
    respaldo: "Ninguna norma pide la carta de la Dirección.",
    tipo: "T→E",
    regimen: "ambos",
    datapoints: [],
    tablas: [],
    perfil: ["carta_texto", "carta_firmante", "carta_cargo"],
  },
  {
    clave: "presentacion",
    numero: 2,
    seccion: "I · Introducción",
    titulo: "Presentación del informe (adopción, CNBV)",
    clase: "normativo",
    respaldo: "NIIF S1 72 (declaración de cumplimiento). La mención de la CNBV es regulación local.",
    tipo: "Plantilla",
    regimen: "ambos",
    datapoints: [],
    tablas: ["reportes"],
    perfil: ["denominacion_formal", "nombre_corto"],
  },
  {
    clave: "bases_preparacion",
    numero: 3,
    seccion: "I · Introducción",
    titulo: "Bases de preparación: marco y alivios transitorios",
    clase: "normativo",
    respaldo: "NIIF S1 E5–E6 (alivio «primero clima») y NIIF S2 C3–C5 (alivios del primer año).",
    tipo: "Plantilla",
    regimen: "varia_por_regimen",
    datapoints: [],
    tablas: ["reportes"],
    perfil: [],
  },
  {
    clave: "entidad_que_informa",
    numero: 4,
    seccion: "I · Introducción",
    titulo: "Entidad que informa, periodo y conectividad",
    clase: "normativo",
    respaldo: "NIIF S1 20 y 64 (misma entidad y periodo que los estados financieros); NIIF S2 32.",
    tipo: "Plantilla + T→E",
    regimen: "ambos",
    datapoints: ["NIIF S2 32"],
    tablas: ["reportes", "solicitudes"],
    perfil: ["denominacion_formal", "entidad_que_informa", "perimetro"],
  },
  {
    clave: "conexiones",
    numero: 5,
    seccion: "I · Introducción",
    titulo: "Conexiones y referencias cruzadas",
    clase: "normativo",
    respaldo: "NIIF S1 21–24 (información conectada) y 63 (referencias cruzadas).",
    tipo: "Plantilla",
    regimen: "ambos",
    datapoints: [],
    tablas: [],
    perfil: [],
  },
  {
    clave: "juicios_incertidumbres",
    numero: 6,
    seccion: "I · Introducción",
    titulo: "Juicios, supuestos e incertidumbres",
    clase: "normativo",
    respaldo: "NIIF S1 74–79 (juicios e incertidumbre en la medición).",
    tipo: "D→T + Tabla",
    regimen: "varia_por_regimen",
    datapoints: ["NIIF S1 74"],
    tablas: ["capturas_valor"],
    perfil: [],
  },
  {
    clave: "materialidad",
    numero: 7,
    seccion: "I · Introducción",
    titulo: "Materialidad: contexto y proceso",
    clase: "editorial_recomendado",
    respaldo: "Contexto que la emisora suele querer: S1 17–18 pide aplicar la materialidad, no describir el proceso.",
    tipo: "T→E",
    regimen: "varia_por_regimen",
    datapoints: [],
    tablas: [],
    perfil: ["proceso_materialidad"],
  },
  {
    clave: "horizontes",
    numero: 8,
    seccion: "I · Introducción",
    titulo: "Horizontes temporales",
    clase: "normativo",
    respaldo: "NIIF S2 10(d) (horizontes de corto, mediano y largo plazo).",
    tipo: "Tabla",
    regimen: "ambos",
    datapoints: [],
    tablas: [],
    perfil: ["horizontes"],
  },
  {
    clave: "priorizacion_riesgos",
    numero: 9,
    seccion: "I · Introducción",
    titulo: "Evaluación y priorización de riesgos",
    clase: "normativo",
    respaldo: "NIIF S2 25(a)(ii)–(iv) (evaluación y priorización); se solapa con el 27.",
    tipo: "D→T + Tabla",
    regimen: "ambos",
    datapoints: [],
    tablas: ["registros_clima"],
    perfil: ["matriz_riesgos"],
  },
  {
    clave: "efectos_financieros",
    numero: 10,
    seccion: "I · Introducción",
    titulo: "Resumen de efectos financieros actuales y previstos",
    clase: "normativo",
    respaldo: "NIIF S2 15–16 (efectos financieros actuales y previstos).",
    tipo: "D→T",
    regimen: "varia_por_regimen",
    datapoints: ["NIIF S2 16(a)", "NIIF S2 16(b)", "NIIF S2 16(c)(i)(ii)", "NIIF S2 16(d)"],
    tablas: ["capturas_valor"],
    perfil: [],
  },
  {
    clave: "historia",
    numero: 11,
    seccion: "I · Introducción",
    titulo: "Nuestra historia (línea de tiempo)",
    clase: "editorial_opcional",
    respaldo: "Contexto de la emisora; no lo exige ningún párrafo.",
    tipo: "Tabla + T→E",
    regimen: "ambos",
    datapoints: [],
    tablas: [],
    perfil: ["hitos_corporativos"],
  },
  {
    clave: "modelo_negocio",
    numero: 12,
    seccion: "I · Introducción",
    titulo: "Modelo de negocio y cadena de valor",
    clase: "editorial_opcional",
    respaldo: "La norma pide los efectos sobre el modelo de negocio y la cadena de valor (bloque 13), no describirlos.",
    tipo: "T→E",
    regimen: "ambos",
    datapoints: [],
    tablas: [],
    perfil: ["modelo_negocio", "cadena_valor"],
  },
  {
    clave: "efectos_modelo_cadena",
    numero: 13,
    seccion: "I · Introducción",
    titulo: "Efectos sobre el modelo de negocio y la cadena de valor",
    clase: "normativo",
    respaldo: "NIIF S2 13 (efectos sobre el modelo de negocio y la cadena de valor).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 13(a)", "NIIF S2 13(b)"],
    tablas: ["registros_clima"],
    perfil: [],
  },
  {
    clave: "intro_gobernanza",
    numero: 14,
    seccion: "II · Gobernanza",
    titulo: "Introducción a la sección",
    clase: "editorial_opcional",
    respaldo: "Texto de paso entre secciones.",
    tipo: "Plantilla",
    regimen: "ambos",
    datapoints: [],
    tablas: [],
    perfil: [],
  },
  {
    clave: "roles_organo",
    numero: 15,
    seccion: "II · Gobernanza",
    titulo: "Roles y responsabilidades del órgano de gobierno",
    clase: "normativo",
    respaldo: "NIIF S2 6(a), (a)(i)–(ii).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 6 (a)", "NIIF S2 6 (a)(i)", "NIIF S2 6 (a)(ii)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "supervision_estrategia",
    numero: 16,
    seccion: "II · Gobernanza",
    titulo: "Supervisión de la estrategia, objetivos y remuneración",
    clase: "normativo",
    respaldo: "NIIF S2 6(a)(iii)–(v).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 6 (a)(iii)", "NIIF S2 6 (a)(iv)", "NIIF S2 6 (a)(v)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "gerencia_controles",
    numero: 17,
    seccion: "II · Gobernanza",
    titulo: "Papel de la gerencia y controles",
    clase: "normativo",
    respaldo: "NIIF S2 6(b).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 6(b)", "NIIF S2 6(b)(i)", "NIIF S2 6(b)(ii)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "estructura_gobierno",
    numero: 18,
    seccion: "II · Gobernanza",
    titulo: "Estructura de gobierno corporativo y organigrama",
    clase: "editorial_recomendado",
    respaldo: "Complementa a 15–17: S2 6 pide identificar al órgano y su papel, no el organigrama.",
    tipo: "T→E + imagen",
    regimen: "ambos",
    datapoints: [],
    tablas: [],
    perfil: ["gobierno_texto", "organigrama_path"],
  },
  {
    clave: "trayectoria_sostenibilidad",
    numero: 19,
    seccion: "III · Estrategia",
    titulo: "Trayectoria en sostenibilidad y clima",
    clase: "editorial_opcional",
    respaldo: "Contexto de la emisora; no lo exige ningún párrafo.",
    tipo: "Tabla + T→E",
    regimen: "ambos",
    datapoints: [],
    tablas: [],
    perfil: ["hitos_sostenibilidad"],
  },
  {
    clave: "contexto_estrategico",
    numero: 20,
    seccion: "III · Estrategia",
    titulo: "Contexto estratégico",
    clase: "editorial_opcional",
    respaldo: "S2 9 es el objetivo de la sección de estrategia, no un requisito de revelación.",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: [],
    tablas: [],
    perfil: ["horizontes"],
  },
  {
    clave: "riesgos_prioritarios",
    numero: 21,
    seccion: "III · Estrategia",
    titulo: "Riesgos climáticos prioritarios",
    clase: "normativo",
    respaldo: "NIIF S2 10.",
    tipo: "D→T + Tabla",
    regimen: "ambos",
    datapoints: ["NIIF S2 10(a), (b)y(c)", "NIIF S2 10(d)"],
    tablas: ["registros_clima"],
    perfil: ["matriz_riesgos"],
  },
  {
    clave: "cambios_modelo_recursos",
    numero: 22,
    seccion: "III · Estrategia",
    titulo: "Cambios en modelo de negocio y asignación de recursos",
    clase: "normativo",
    respaldo: "NIIF S2 14(a)(i)–(ii).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 14(a)(i)", "NIIF S2 14(a)(ii)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "esfuerzos_reduccion",
    numero: 23,
    seccion: "III · Estrategia",
    // Solo 14(a)(iii): los esfuerzos directos, 14(a)(ii), son del 22 (tercera revisión externa, C).
    titulo: "Esfuerzos indirectos de reducción y adaptación",
    clase: "normativo",
    respaldo: "NIIF S2 14(a)(iii).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 14(a)(iii)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "oportunidades",
    numero: 24,
    seccion: "III · Estrategia",
    titulo: "Oportunidades y cómo prevé alcanzar objetivos",
    clase: "normativo",
    respaldo: "NIIF S2 10(a) y 14(a)(v). Se solapa con 21 y 25: fusión anotada como deuda de estructura.",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: [],
    tablas: ["registros_clima", "objetivos"],
    perfil: [],
  },
  {
    clave: "recursos_progreso",
    numero: 25,
    seccion: "III · Estrategia",
    titulo: "Recursos asignados y progreso de planes",
    clase: "normativo",
    respaldo: "NIIF S2 14(a)(v), 14(b) y 14(c).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 14(a)(v)", "NIIF S2 14(b)", "NIIF S2 14(c)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "resiliencia_escenarios",
    numero: 26,
    seccion: "III · Estrategia",
    titulo: "Resiliencia de la estrategia y análisis de escenarios",
    clase: "normativo",
    respaldo: "NIIF S2 22.",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 22(a)(i)", "NIIF S2 22(a)(ii)", "NIIF S2 22(a)(iii)", "NIIF S2 22(b)(i)", "NIIF S2 22(b)(ii)", "NIIF S2 22(b)(iii)"],
    tablas: ["cuestionarios_respuestas"],
    perfil: [],
  },
  {
    clave: "gestion_riesgos",
    numero: 27,
    seccion: "IV · Riesgos",
    titulo: "Gestión y mitigación de riesgos y oportunidades",
    clase: "normativo",
    respaldo: "NIIF S2 25.",
    tipo: "D→T",
    regimen: "ambos",
    // Incisos por separado desde el 7 de octubre de 2026 (catálogo partido; antes «NIIF S2 25 (a)(i)a(v)»).
    datapoints: ["NIIF S2 25 (a)(i)", "NIIF S2 25 (a)(ii)", "NIIF S2 25 (a)(iii)", "NIIF S2 25 (a)(iv)", "NIIF S2 25 (a)(v)", "NIIF S2 25 (a)(vi)", "NIIF S2 25 (b)", "NIIF S2 25 (c)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "plan_transicion",
    numero: 28,
    seccion: "IV · Riesgos",
    titulo: "Plan de transición",
    clase: "normativo",
    respaldo: "NIIF S2 14(a)(iv).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 14(a)(iv)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "gei_alcance_1_2",
    numero: 29,
    seccion: "V · Métricas y objetivos",
    titulo: "Emisiones GEI Alcance 1 y 2 (+ Alcance 3 según régimen)",
    clase: "normativo",
    respaldo: "NIIF S2 29(a)(i).",
    tipo: "Tabla + D→T",
    regimen: "varia_por_regimen",
    datapoints: ["NIIF S2 29 (a)(i)", "NIIF S2 EI14 a E18", "NIIF S2 EI19 a EI24"],
    tablas: ["capturas_valor", "reportes"],
    perfil: [],
  },
  {
    clave: "metodo_medicion",
    numero: 30,
    seccion: "V · Métricas y objetivos",
    // Sin «y C5» en el título: el método previo conservado bajo C5 solo se describe si el alivio está adoptado
    // (tercera revisión externa, C).
    titulo: "Método de medición y datos de entrada",
    clase: "normativo",
    respaldo: "NIIF S2 29(a)(ii)–(iii).",
    tipo: "D→T",
    regimen: "varia_por_regimen",
    datapoints: ["NIIF S2 29 (a)(ii)", "NIIF S2 29 (a)(iii)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "razones_enfoque",
    numero: 31,
    seccion: "V · Métricas y objetivos",
    titulo: "Razones del enfoque y desagregación",
    clase: "normativo",
    respaldo: "NIIF S2 29(a)(iv).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 29 (a)(iv) EI5"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "alcance_2_contractual",
    numero: 32,
    seccion: "V · Métricas y objetivos",
    titulo: "Alcance 2 por ubicación e instrumentos contractuales",
    clase: "normativo",
    respaldo: "NIIF S2 29(a)(v).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 29 (a)(v)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "emisiones_financiadas",
    numero: 33,
    seccion: "V · Métricas y objetivos",
    titulo: "Emisiones financiadas",
    clase: "normativo",
    respaldo: "NIIF S2 29(a)(vi).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 29 (a)(vi)(1)", "NIIF S2 29 (a)(vi)(1) EI12", "NIIF S2 29 (a)(vi)(2)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "riesgos_transicion_metricas",
    numero: 34,
    seccion: "V · Métricas y objetivos",
    titulo: "Riesgos de transición: concentración, exposición y capital",
    clase: "normativo",
    respaldo: "NIIF S2 29(b), B64–B65 (riesgos de transición).",
    tipo: "Tabla + D→T",
    regimen: "varia_por_regimen",
    // Sin NIIF S2 30: es la exención por costo o esfuerzo para 29(b)–(d), no un
    // requisito de revelación (clasificación del encargo suplemento-calidad).
    datapoints: ["NIIF S2 29 (b)", "NIIF S2 29 (b) · B65 (b)", "NIIF S2 29 (b) · B65 (c)"],
    tablas: ["registros_clima_valores"],
    perfil: [],
  },
  {
    clave: "riesgos_fisicos_metricas",
    numero: 35,
    seccion: "V · Métricas y objetivos",
    titulo: "Riesgos físicos: exposición y gráfica",
    clase: "normativo",
    respaldo: "NIIF S2 29(c), B64–B65 (riesgos físicos).",
    tipo: "Tabla + D→T",
    regimen: "varia_por_regimen",
    // 29 (c) es el requisito principal del bloque —cantidad y porcentaje de
    // activos vulnerables a riesgos físicos— y hasta la auditoría del catálogo
    // no tenía código: su texto estaba archivado bajo el de 29(b), que es el de
    // transición. La especificación lo asigna aquí desde la v0.1.
    datapoints: ["NIIF S2 29 (c)", "NIIF S2 29 (c) · B65 (b)", "NIIF S2 29 (c) · B65 (c)"],
    tablas: ["registros_clima_valores"],
    perfil: [],
  },
  {
    clave: "oportunidades_metricas",
    numero: 36,
    seccion: "V · Métricas y objetivos",
    titulo: "Oportunidades: alineación y capital",
    clase: "normativo",
    respaldo: "NIIF S2 29(d) y (e).",
    tipo: "Tabla + D→T",
    regimen: "varia_por_regimen",
    datapoints: ["NIIF S2 29 (d)", "NIIF S2 29 (d) · B65 (b)", "NIIF S2 29 (d) · B65 (c)", "NIIF S2 29 (e)"],
    tablas: ["registros_clima_valores"],
    perfil: [],
  },
  {
    clave: "precio_carbono",
    numero: 37,
    seccion: "V · Métricas y objetivos",
    titulo: "Precio interno del carbono y remuneración vinculada",
    clase: "normativo",
    respaldo: "NIIF S2 29(f) y (g).",
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 29 (f) (i) y (ii)", "NIIF S2 29 (g) (i) y (ii)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "objetivos_climaticos",
    numero: 38,
    seccion: "V · Métricas y objetivos",
    titulo: "Objetivos climáticos (atributos por objetivo)",
    clase: "normativo",
    respaldo: "NIIF S2 33.",
    tipo: "Tabla",
    regimen: "varia_por_regimen",
    datapoints: ["NIIF S2 33"],
    tablas: ["objetivos"],
    perfil: [],
  },
  {
    clave: "enfoque_objetivos",
    numero: 39,
    seccion: "V · Métricas y objetivos",
    titulo: "Enfoque para establecer y revisar objetivos; resultados",
    clase: "normativo",
    respaldo: "NIIF S2 34–35.",
    tipo: "Tabla + D→T",
    regimen: "varia_por_regimen",
    datapoints: ["NIIF S2 34", "NIIF S2 35"],
    tablas: ["objetivos_detalle"],
    perfil: [],
  },
  {
    clave: "objetivo_gei",
    numero: 40,
    seccion: "V · Métricas y objetivos",
    titulo: "Objetivo de emisiones GEI",
    clase: "normativo",
    respaldo: "NIIF S2 36.",
    tipo: "Tabla + D→T",
    regimen: "varia_por_regimen",
    // Incisos por separado desde el 7 de octubre de 2026 (antes «NIIF S2 36 (a)a(d)» y «NIIF S2 36 (e)(i)a(iv)»).
    datapoints: ["NIIF S2 36 (a)", "NIIF S2 36 (b)", "NIIF S2 36 (c)", "NIIF S2 36 (d)", "NIIF S2 36 (e)(i)", "NIIF S2 36 (e)(ii)", "NIIF S2 36 (e)(iii)", "NIIF S2 36 (e)(iv)"],
    tablas: ["objetivos_detalle", "cuestionarios_respuestas"],
    perfil: [],
  },
];

/** Todos los códigos citados por el mapeo, sin repetir. */
export function codigosDelMapeo(): string[] {
  return [...new Set(BLOQUES.flatMap((b) => b.datapoints))];
}

export function bloquePorClave(clave: string): Bloque | undefined {
  return BLOQUES.find((b) => b.clave === clave);
}

// -----------------------------------------------------------------------------
// SELECCIÓN DE EDITORIALES (encargo suplemento-calidad, Paso 1).
// -----------------------------------------------------------------------------

export function esEditorial(b: Pick<Bloque, "clase">): boolean {
  return b.clase !== "normativo";
}

/** Claves de los editoriales encendidos por defecto (los recomendados). */
export function editorialesPorDefecto(): string[] {
  return BLOQUES.filter((b) => b.clase === "editorial_recomendado").map((b) => b.clave);
}

/**
 * ¿Va este bloque en un documento con esa selección? Los normativos, siempre.
 * `incluidos === null` es un documento anterior a la selección: llevaba los 40.
 */
export function bloqueSeleccionado(b: Pick<Bloque, "clase" | "clave">, incluidos: string[] | null): boolean {
  if (!esEditorial(b)) return true;
  if (incluidos === null) return true;
  return incluidos.includes(b.clave);
}

/** Normaliza una selección pedida: solo claves de editoriales, sin repetir. */
export function normalizarSeleccion(pedidos: unknown): string[] {
  const validas = new Set(BLOQUES.filter(esEditorial).map((b) => b.clave));
  if (!Array.isArray(pedidos)) return editorialesPorDefecto();
  return [...new Set(pedidos.filter((x): x is string => typeof x === "string" && validas.has(x)))];
}
