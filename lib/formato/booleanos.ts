import mapeoFormato from "@/docs/suplemento-s1s2/mapeo-formato-electronico.json" with { type: "json" };

// =============================================================================
// BOOLEANOS DEL FORMATO ELECTRÓNICO (encargo formato-afirmaciones-y-voz, D1).
//
// Antes, un booleano con datapoint decía «No» si ALGUNO de los hechos anclados a
// la respuesta del código era una declaración negativa, y «Sí» si ninguno lo era:
// no miraba la pregunta. Así K38 salió «Sí» (el hecho de la remuneración es de
// tipo `politica`) y K592 «No» (el único negativo era el de C5).
//
// Ahora cada booleano tiene una respuesta propia (`fila:N`, destino formato) que
// abre con «Sí.» o «No.» y cita el hecho que contesta la pregunta. Lo valida el
// código, aquí y al llenar el formato:
//   · abre con «Sí.» o «No.»;
//   · cita un hecho que trata el tema de la pregunta (y existe: es uno de los
//     entregados);
//   · la polaridad de ese hecho, en la cláusula que trata el tema, no lo
//     contradice;
//   · ni el resto de la respuesta ni la celda narrativa vecina (la respuesta del
//     mismo código) dicen lo contrario.
// Lo que no pasa no se escribe: la celda queda vacía (pendiente), nunca con un
// valor que su propia explicación contradice.
//
// Las preguntas son paráfrasis de la casa, no el texto de la plantilla.
// =============================================================================

export type PreguntaBooleana = { fila: number; codigo: string; pregunta: string; trata: string; tema: RegExp };

const PREGUNTAS: Record<number, Omit<PreguntaBooleana, "fila" | "codigo">> = {
  38: { pregunta: "¿Las métricas de desempeño relacionadas con el clima se incluyen en las políticas de remuneración?", trata: "la remuneración", tema: /remuneraci[oó]n/i },
  44: { pregunta: "¿La gestión de los riesgos y oportunidades relacionados con el clima se delega en un cargo o un comité de la dirección?", trata: "la delegación en la dirección", tema: /deleg|direcci[oó]n de|director|comit[eé] de direcci[oó]n/i },
  49: { pregunta: "¿La gerencia utiliza controles y procedimientos para apoyar la supervisión de los riesgos y oportunidades relacionados con el clima?", trata: "los controles y procedimientos", tema: /controles?|procedimientos?/i },
  134: { pregunta: "¿Cambiaron los procesos de gestión de riesgos respecto del periodo anterior?", trata: "los cambios en los procesos", tema: /cambi|incorpor|periodo anterior/i },
  237: { pregunta: "¿El objetivo y la metodología para fijarlo han sido validados por un tercero?", trata: "la validación por un tercero", tema: /tercero/i },
  253: { pregunta: "¿El objetivo se obtuvo con un enfoque de descarbonización sectorial?", trata: "el enfoque de descarbonización sectorial", tema: /descarbonizaci[oó]n sectorial/i },
  256: { pregunta: "¿Se prevé usar créditos de carbono para alcanzar los objetivos de emisiones?", trata: "los créditos de carbono", tema: /cr[eé]ditos? de carbono/i },
  313: { pregunta: "¿La emisora mide sus emisiones de gases de efecto invernadero conforme al Protocolo GEI?", trata: "el Protocolo GEI", tema: /protocolo GEI|GHG Protocol/i },
  417: { pregunta: "¿La emisora aplica un precio del carbono en la toma de decisiones?", trata: "el precio del carbono", tema: /precio[^.;]{0,40}carbono/i },
  425: { pregunta: "¿Las consideraciones relacionadas con el clima se tienen en cuenta en la remuneración de los ejecutivos?", trata: "la remuneración", tema: /remuneraci[oó]n/i },
};

type Concepto = { fila: number; tipo?: string | null; clasificacion?: string; datapoint?: string | null };

/** Booleanos del formato con datapoint y pregunta: los que tienen respuesta propia. */
export const BOOLEANOS_FORMATO: PreguntaBooleana[] = (mapeoFormato as unknown as { conceptos: Concepto[] }).conceptos
  .filter((c) => c.tipo === "booleano" && c.clasificacion === "concepto" && c.datapoint && PREGUNTAS[c.fila])
  .map((c) => ({ fila: c.fila, codigo: c.datapoint!, ...PREGUNTAS[c.fila] }));

const NIEGA = /(?<!\p{L})(?:no|ningun[oa]?|ningún|nul[oa]s?|sin|tampoco|ni|nunca)(?!\p{L})/iu;

/** «Sí» o «No» si el texto abre con «Sí.» o «No.»; si no, null. */
export function valorBooleano(texto: string | null): "Sí" | "No" | null {
  return (texto ?? "").trim().match(/^(Sí|No)\./)?.[1] as "Sí" | "No" | null ?? null;
}

/**
 * Cláusulas del texto que tratan el tema, con su polaridad. Se corta por oración y por «;», y por «:» cuando lo
 * que sigue es una cláusula (más de tres palabras): así «no hace uso de C5: mide conforme al Protocolo GEI» da
 * dos cláusulas, y «enfoque de descarbonización sectorial: No» una sola.
 */
export function clausulasDelTema(texto: string, tema: RegExp): { texto: string; niega: boolean }[] {
  const partes = texto.split(/(?<=[.;])\s+/).flatMap((o) => {
    const i = o.indexOf(":");
    return i > 0 && o.slice(i + 1).trim().split(/\s+/).length > 3 ? [o.slice(0, i), o.slice(i + 1)] : [o];
  });
  return partes.filter((c) => tema.test(c)).map((c) => ({ texto: c.trim(), niega: NIEGA.test(c) }));
}

/** El texto dice lo contrario del valor: todas sus cláusulas sobre el tema van en el sentido opuesto. */
export function contradice(valor: "Sí" | "No", texto: string | null, tema: RegExp): boolean {
  const cl = clausulasDelTema(texto ?? "", tema);
  if (!cl.length) return false;
  return valor === "Sí" ? cl.every((c) => c.niega) : cl.every((c) => !c.niega);
}

type HechoCitable = { local: string; enunciado: string };

/** Errores de una respuesta booleana; vacío si pasa. */
export function validarBooleano(
  texto: string,
  ctx: { pregunta: PreguntaBooleana; hechos: HechoCitable[]; citados: string[]; vecina: string | null }
): string[] {
  const { tema, trata } = ctx.pregunta;
  const valor = valorBooleano(texto);
  if (!valor) return ["debe abrir con «Sí.» o «No.», que contesta la pregunta"];
  const errores: string[] = [];
  const contestan = ctx.hechos.filter((h) => ctx.citados.includes(h.local) && clausulasDelTema(h.enunciado, tema).length);
  if (!contestan.length) errores.push(`no cita el hecho que contesta la pregunta: debe citar uno que trate de ${trata}`);
  const polaridades = contestan.flatMap((h) => clausulasDelTema(h.enunciado, tema).map((c) => c.niega));
  if (polaridades.length && valor === "Sí" && polaridades.every(Boolean)) errores.push(`dice «Sí», pero el hecho que cita sobre ${trata} lo niega`);
  if (polaridades.length && valor === "No" && polaridades.every((n) => !n)) errores.push(`dice «No», pero el hecho que cita sobre ${trata} lo afirma`);
  if (contradice(valor, texto.trim().replace(/^(Sí|No)\.\s*/, ""), tema)) errores.push(`el resto de la respuesta dice lo contrario del «${valor}»`);
  if (contradice(valor, ctx.vecina, tema)) errores.push(`la celda narrativa vecina (respuesta de ${ctx.pregunta.codigo}) dice lo contrario del «${valor}»`);
  return errores;
}
