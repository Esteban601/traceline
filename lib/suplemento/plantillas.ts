import { ALIVIOS, REGIMEN_LABEL, type Alivios, type Regimen } from "@/lib/perfil-emisor";

// =============================================================================
// LOS CUATRO BLOQUES DE PLANTILLA: texto fijo con variables.
//
// No pasan por el modelo. Su contenido no depende de la evidencia del cliente
// sino del reporte y del emisor, y una llamada al modelo para rellenar tres
// huecos es gasto y riesgo —un modelo puede reescribir la frase— sin ganancia.
//
// LA ÚNICA EXCEPCIÓN es el bloque 3, cuya oración sobre los alivios cambia según
// cuáles se hayan adoptado. Se arma con una lista determinista; solo si el
// conjunto de alivios no encaja en ninguna forma prevista se pide a Sonnet 5 que
// redacte esa oración. Con los cinco alivios de la norma, las formas previstas
// cubren todos los casos, así que hoy no se llama nunca.
// =============================================================================

export type CtxPlantilla = {
  denominacionFormal: string;
  formaDeReferencia: string;
  ejercicio: number;
  regimen: Regimen;
  anioAdopcion: number | null;
  alivios: Alivios;
  nombreReporte: string;
};

export type ResultadoPlantilla = {
  texto: string;
  /** Qué campos del Perfil o del reporte faltaban. Van como [Pendiente: …]. */
  pendientes: string[];
};

const P = (que: string, donde: string) => `[Pendiente: ${que} — ${donde}]`;

function frasesDeAlivios(a: Alivios): string {
  const adoptados = ALIVIOS.filter((x) => a[x.clave]);
  if (adoptados.length === 0) {
    return "La Entidad no se acoge a ninguna de las medidas transitorias previstas en el Apéndice C de la NIIF S2 ni en el Apéndice E de la NIIF S1.";
  }
  const lista = adoptados.map((x) => `el párrafo ${x.clave}`).join(", ").replace(/, (el párrafo [^,]+)$/, " y $1");
  return `La Entidad se acoge a las medidas transitorias previstas en ${lista}, cuyos efectos sobre la información presentada se describen en el apartado correspondiente de cada sección.`;
}

/** Bloque 2 · Presentación del informe. */
function presentacion(c: CtxPlantilla): ResultadoPlantilla {
  const pendientes: string[] = [];
  const den = c.denominacionFormal || (pendientes.push(P("denominación formal", "Perfil del emisor, sección Identidad")), P("denominación formal", "Perfil del emisor, sección Identidad"));
  return {
    texto: [
      `${den} (en adelante, ${c.formaDeReferencia}) presenta la información a revelar relacionada con la sostenibilidad y con el clima correspondiente al ejercicio ${c.ejercicio}, preparada de conformidad con las Normas NIIF S1 y NIIF S2 emitidas por el Consejo de Normas Internacionales de Sostenibilidad.`,
      "",
      `Esta información se presenta como parte del informe anual y acompaña a los estados financieros del mismo periodo, conforme a lo previsto por la regulación aplicable a las emisoras inscritas en el Registro Nacional de Valores.`,
    ].join("\n"),
    pendientes,
  };
}

/** Bloque 3 · Bases de preparación: marco y medidas transitorias. */
function basesPreparacion(c: CtxPlantilla): ResultadoPlantilla {
  const pendientes: string[] = [];
  let regimenFrase: string;
  if (c.anioAdopcion == null) {
    const p = P("año de adopción de las Normas NIIF S1 y S2", "Reportes, régimen del ejercicio");
    pendientes.push(p);
    regimenFrase = `El presente ejercicio corresponde a ${p}.`;
  } else if (c.regimen === "primer_anio") {
    regimenFrase = `El ejercicio ${c.ejercicio} es el primer periodo anual sobre el que ${c.formaDeReferencia} informa de conformidad con las Normas NIIF S1 y NIIF S2.`;
  } else {
    regimenFrase = `${c.formaDeReferencia} informa de conformidad con las Normas NIIF S1 y NIIF S2 desde el ejercicio ${c.anioAdopcion}; el presente periodo es un ejercicio subsecuente.`;
  }
  return {
    texto: [
      `La información a revelar se prepara de conformidad con la NIIF S1 Requerimientos Generales para la Información Financiera a Revelar relacionada con la Sostenibilidad y con la NIIF S2 Información a Revelar relacionada con el Clima.`,
      "",
      regimenFrase,
      "",
      frasesDeAlivios(c.alivios),
    ].join("\n"),
    pendientes,
  };
}

/** Bloque 5 · Conexiones y referencias cruzadas. */
function conexiones(c: CtxPlantilla): ResultadoPlantilla {
  return {
    texto: [
      `La información a revelar sobre sostenibilidad y clima se presenta de forma conectada con los estados financieros del mismo periodo: emplea, en la medida de lo posible, los mismos datos y supuestos, y se refiere al mismo periodo sobre el que se informa y a la misma entidad que informa.`,
      "",
      `Cuando una cifra revelada en esta sección guarda relación con un importe reconocido o revelado en los estados financieros, la relación se indica en el apartado que la contiene.`,
    ].join("\n"),
    pendientes: [],
  };
}

/** Bloque 14 · Introducción a la sección de gobernanza. */
function introGobernanza(c: CtxPlantilla): ResultadoPlantilla {
  return {
    texto: [
      `Esta sección describe los procesos, controles y procedimientos de gobernanza que ${c.formaDeReferencia} utiliza para supervisar, gestionar y vigilar los riesgos y oportunidades relacionados con el clima, así como el papel del órgano de gobierno y de la gerencia en esos procesos.`,
    ].join("\n"),
    pendientes: [],
  };
}

export const PLANTILLAS: Record<number, (c: CtxPlantilla) => ResultadoPlantilla> = {
  2: presentacion,
  3: basesPreparacion,
  5: conexiones,
  14: introGobernanza,
};

/** Para el log y la especificación: qué régimen produce qué frase en el bloque 3. */
export function describeAlivios(a: Alivios, r: Regimen): string {
  return `${REGIMEN_LABEL[r]} · ${frasesDeAlivios(a).slice(0, 60)}…`;
}
