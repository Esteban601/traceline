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
    titulo: "Esfuerzos directos e indirectos de reducción y adaptación",
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
    tipo: "D→T",
    regimen: "ambos",
    datapoints: ["NIIF S2 25 (a)(i)a(v)", "NIIF S2 25 (a)(vi)", "NIIF S2 25 (b)", "NIIF S2 25 (c)"],
    tablas: [],
    perfil: [],
  },
  {
    clave: "plan_transicion",
    numero: 28,
    seccion: "IV · Riesgos",
    titulo: "Plan de transición",
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
    titulo: "Método de medición, datos de entrada y C5",
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
    tipo: "Tabla + D→T",
    regimen: "varia_por_regimen",
    datapoints: ["NIIF S2 30", "NIIF S2 29 (b) B64 y B65 inciso (a)", "NIIF S2 29 (b) B64 y B65 inciso (b)", "NIIF S2 29 (b) B64 y B65 inciso (c)"],
    tablas: ["registros_clima_valores"],
    perfil: [],
  },
  {
    clave: "riesgos_fisicos_metricas",
    numero: 35,
    seccion: "V · Métricas y objetivos",
    titulo: "Riesgos físicos: exposición y gráfica",
    tipo: "Tabla + D→T",
    regimen: "varia_por_regimen",
    datapoints: ["NIIF S2 29 (c) B64 y B65 inciso (b)", "NIIF S2 29 (c) B64 y B65 inciso (c)"],
    tablas: ["registros_clima_valores"],
    perfil: [],
  },
  {
    clave: "oportunidades_metricas",
    numero: 36,
    seccion: "V · Métricas y objetivos",
    titulo: "Oportunidades: alineación y capital",
    tipo: "Tabla + D→T",
    regimen: "varia_por_regimen",
    datapoints: ["NIIF S2 29 (d) B64 y B65 inciso (a)", "NIIF S2 29 (d) B64 y B65 inciso (b)", "NIIF S2 29 (d) B64 y B65 inciso (c)", "NIIF S2 29 (e)"],
    tablas: ["registros_clima_valores"],
    perfil: [],
  },
  {
    clave: "precio_carbono",
    numero: 37,
    seccion: "V · Métricas y objetivos",
    titulo: "Precio interno del carbono y remuneración vinculada",
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
    tipo: "Tabla + D→T",
    regimen: "varia_por_regimen",
    datapoints: ["NIIF S2 36 (a)a(d)", "NIIF S2 36 (e)(i)a(iv)"],
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
