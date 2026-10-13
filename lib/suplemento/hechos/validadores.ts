// =============================================================================
// VALIDADORES DETERMINISTAS DEL BLOQUE (encargo suplemento-calidad, Paso 5.4).
//
// Después de generar, sin modelo:
//   · rangos: un rango que contradice la escala de la matriz de riesgos del
//     Perfil (con probabilidad e impacto de 1 a 5 la severidad va de 1 a 25; un
//     «0 a 25» no existe) se rechaza;
//   · referencias reescritas: si el texto copia frases de un hecho que es de OTRO
//     bloque —en vez de remitir en una línea—, se rechaza con el bloque dueño;
//   · el glosario (glosario.ts) no rechaza: sustituye y deja nota.
// Los rechazos vuelven al modelo con el detalle concreto, como los demás.
// =============================================================================

export type Matriz = { niveles?: { nombre: string; min: number; max: number }[]; escala_max?: number } | null;

const RE_RANGO = /\b(?:de|entre)\s+(\d{1,3})\s+(?:a|y|hasta)\s+(\d{1,3})\b/gi;

/** Rangos del texto que no caben en la escala de la matriz. */
export function rangosIncoherentes(texto: string, matriz: Matriz): string[] {
  const max = matriz?.escala_max;
  if (!max) return [];
  // Escala de probabilidad e impacto: la raíz entera de la máxima (25 → 5).
  const lado = Math.round(Math.sqrt(max));
  const producto = lado * lado === max;
  const errores: string[] = [];
  for (const m of texto.replace(/\[Pendiente:[^\]]*\]/g, " ").matchAll(RE_RANGO)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > b) errores.push(`«${m[0]}»: el inicio es mayor que el final`);
    else if (b === max && producto && a === 0) errores.push(`«${m[0]}»: con probabilidad e impacto de 1 a ${lado}, la severidad va de 1 a ${max}; no hay severidad 0`);
    else if (b > max && producto && b !== lado) errores.push(`«${m[0]}»: la escala de la matriz llega a ${max}`);
  }
  return errores;
}

/** Problemas de la matriz misma (para el pre-vuelo): niveles que empiezan en 0, huecos o traslapes. */
export function defectosDeMatriz(matriz: Matriz): string[] {
  const niveles = [...(matriz?.niveles ?? [])].sort((x, y) => x.min - y.min);
  if (!niveles.length || !matriz?.escala_max) return [];
  const out: string[] = [];
  const lado = Math.round(Math.sqrt(matriz.escala_max));
  if (lado * lado === matriz.escala_max && niveles[0].min < 1) {
    out.push(`La matriz de riesgos del Perfil empieza el nivel «${niveles[0].nombre}» en ${niveles[0].min}: con probabilidad e impacto de 1 a ${lado}, la severidad mínima es 1.`);
  }
  for (let i = 1; i < niveles.length; i++) {
    const prev = niveles[i - 1];
    const act = niveles[i];
    if (act.min > prev.max + 1) out.push(`La matriz de riesgos deja un hueco entre «${prev.nombre}» (hasta ${prev.max}) y «${act.nombre}» (desde ${act.min}).`);
    if (act.min <= prev.max) out.push(`La matriz de riesgos traslapa «${prev.nombre}» y «${act.nombre}».`);
  }
  if (niveles[niveles.length - 1].max !== matriz.escala_max) out.push(`El último nivel de la matriz termina en ${niveles[niveles.length - 1].max} y la escala llega a ${matriz.escala_max}.`);
  return out;
}

/**
 * Frases de la traducción oficial de la norma: aparecen en cualquier bloque y no
 * son contenido de otro. Se quitan antes de comparar, igual que los nombres.
 */
export const FRASES_NORMATIVAS = [
  "los riesgos y oportunidades relacionados con el clima",
  "riesgos y oportunidades relacionados con el clima",
  "riesgos relacionados con el clima",
  "oportunidades relacionadas con el clima",
  "gases de efecto invernadero",
  "información a revelar",
  "toneladas métricas equivalentes de CO2",
  "Normas NIIF S1 y S2",
];

const palabras = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\[pendiente:[^\]]*\]/g, " ").replace(/[^a-z0-9ñ ]+/g, " ").split(/\s+/).filter(Boolean);
function frases(t: string, k = 8): Set<string> {
  const w = palabras(t);
  const s = new Set<string>();
  for (let i = 0; i + k <= w.length; i++) s.add(w.slice(i, i + k).join(" "));
  return s;
}

/**
 * ¿El texto reescribe un hecho que es de otro bloque? Cuenta las frases de ocho
 * palabras que comparte con la referencia y que NO están en los hechos propios
 * del bloque, ni en sus requisitos, ni en los nombres de la emisora (esas son
 * legítimas). Una basta para pedir que remita.
 */
export function referenciasReescritas(
  texto: string,
  referencias: { bloque: number; completo: string }[],
  legitimo: string[],
  /** Nombres propios (glosario, denominación): no cuentan como contenido repetido. */
  nombres: string[] = [],
  /** Frases de 8 palabras compartidas que hacen falta para decir que se reescribió. */
  minimo = 2
): { bloque: number; frase: string }[] {
  // Un nombre largo («el Comité de Sostenibilidad y Riesgos Climáticos») son seis
  // palabras: cualquier oración que lo nombre compartía una frase de ocho con un
  // hecho ajeno. Los nombres se quitan antes de comparar.
  const ordenados = [...new Set([...nombres, ...FRASES_NORMATIVAS].filter((n) => n && n.trim().split(/\s+/).length > 1))].sort((a, b) => b.length - a.length);
  // Sin distinguir mayúsculas: «Riesgos y oportunidades…» al inicio de oración también cuenta.
  const sinNombres = (t: string) => ordenados.reduce((acc, n) => acc.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " · "), t);
  const propias = new Set<string>();
  for (const l of legitimo) for (const f of frases(sinNombres(l))) propias.add(f);
  const delTexto = frases(sinNombres(texto));
  const out: { bloque: number; frase: string }[] = [];
  const vistos = new Set<number>();
  for (const r of referencias) {
    if (vistos.has(r.bloque)) continue;
    const comunes = [...frases(sinNombres(r.completo))].filter((f) => delTexto.has(f) && !propias.has(f));
    if (comunes.length >= minimo) {
      out.push({ bloque: r.bloque, frase: comunes[0] });
      vistos.add(r.bloque);
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// CAMBIOS DE PROCESO (Paso 5b, punto 7). Si el texto afirma que los procesos no
// cambiaron respecto del periodo anterior, ninguno de los hechos propios del
// bloque puede describir un cambio fechado en el ejercicio («integró», «creó en
// 2025»). Habría cazado el bloque 27 de la segunda revisión.
// -----------------------------------------------------------------------------

export const SIN_CAMBIOS =
  /\b(?:sin cambios|no (?:se )?(?:registraron|registró|presentaron|presentó|hubo|tuvieron|tuvo|realizaron|realizó|experimentaron) (?:ningún |ningunos? )?cambios?|no (?:han |ha )?(?:cambiado|sido modificad[oa]s?)|no (?:se )?(?:cambiaron|cambió|modificaron|modificó)|se mantuvieron sin modificaciones)\b/i;
export const VERBO_CAMBIO =
  /(?<!\p{L})(?:incorpor(?:ó|o|aron|an?)|cre(?:ó|o|aron|ación)|implement(?:ó|o|aron)|adopt(?:ó|o|aron)|modific(?:ó|o|aron)|actualiz(?:ó|o|aron)|ampli(?:ó|o|aron)|sustituy(?:ó|o|eron)|estableci(?:ó|o|eron)|introduj(?:o|eron)|redise[ñn](?:ó|o|aron)|reemplaz(?:ó|o|aron)|aprob(?:ó|o|aron)|conclu(?:yó|yo|yeron)|inici(?:ó|o|aron)|lanz(?:ó|o|aron)|integr(?:ó|o|aron))(?!\p{L})/iu;

/** ¿Describe el hecho un cambio fechado en el ejercicio? */
export function esCambioDelEjercicio(h: { enunciado: string; extracto: string; periodo?: string | null }, ejercicio: number): boolean {
  const t = `${h.enunciado} ${h.extracto}`;
  const anio = String(ejercicio);
  const desde = new RegExp(`desde\\s+(?:el\\s+(?:ejercicio\\s+)?)?${anio}`, "i").test(t);
  return desde || (VERBO_CAMBIO.test(t) && (h.periodo === anio || t.includes(anio) || /durante el ejercicio/i.test(t)));
}

/** Hechos propios que describen un cambio en el ejercicio, si el texto dice que no hubo cambios. */
export function cambiosNegados(texto: string, hechos: { id: string; enunciado: string; extracto: string; periodo?: string | null }[], ejercicio: number): string[] {
  const limpio = texto.replace(/\[Pendiente:[^\]]*\]/g, " ");
  if (!SIN_CAMBIOS.test(limpio)) return [];
  const anio = String(ejercicio);
  return hechos
    .filter((h) => {
      const t = `${h.enunciado} ${h.extracto}`;
      return VERBO_CAMBIO.test(t) && (h.periodo === anio || t.includes(anio) || /durante el ejercicio/i.test(t));
    })
    .map((h) => `${h.id}: ${h.enunciado.slice(0, 160)}`);
}

// -----------------------------------------------------------------------------
// NÚMEROS DE INCISO (Paso 5b, punto 3). El bloque 27 nombró «25(a)(iii)» al
// análisis de escenarios, que es 25(a)(ii); el catálogo agrupa los incisos (i) a
// (v) en un solo código. Donde el catálogo AGRUPA incisos («25 (a)(i)a(v)»), un
// inciso suelto de ese párrafo («25(a)(iii)») no se puede comprobar contra
// nada: se rechaza y se pide el código exacto. Donde el catálogo solo trae el
// párrafo y su letra («16 (c)»), citar «16(c)(i)» es legítimo y pasa (falso
// positivo de la corrida completa del 5b, bloques 10 y 37).
// -----------------------------------------------------------------------------

const INCISO = /\b(\d{1,3})\s?\(([a-z])\)\s?\(([ivx]{1,5})\)/g;
const sinEspacios = (c: string) => c.replace(/^NIIF\s*S[12]\s*/i, "").replace(/\s+/g, "").toLowerCase();

export function incisosInexactos(textos: string[], requisitos: string[]): string[] {
  const exactos = new Set(requisitos.map(sinEspacios));
  const parrafos = new Set(requisitos.filter((r) => /\)a\(/.test(r)).map((r) => sinEspacios(r).match(/^\d{1,3}\([a-z]\)/)?.[0]).filter(Boolean));
  const out = new Set<string>();
  for (const t of textos) {
    for (const m of t.matchAll(INCISO)) {
      const cita = `${m[1]}(${m[2]})(${m[3]})`;
      if (parrafos.has(`${m[1]}(${m[2]})`) && !exactos.has(cita.toLowerCase())) out.add(m[0]);
    }
  }
  return [...out];
}

// -----------------------------------------------------------------------------
// CIFRAS HUÉRFANAS (Paso 5c, tercera revisión externa, B): una cifra que entra a
// una tabla armada por código tiene que aparecer en el texto del bloque o en un
// hecho que la describa (al menos ocho palabras); si no, el revisor recibe una
// nota «cifra sin explicación» (14,200 MDP en la 34, 640 en la 35). No rechaza:
// la cifra está confirmada; lo que falta es decir qué es.
// -----------------------------------------------------------------------------

export function cifrasHuerfanas(
  tabla: string,
  texto: string,
  hechos: { enunciado: string }[],
  numeros: (t: string) => number[]
): { fila: string; columna: string; cifra: string }[] {
  const lineas = tabla.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lineas.length < 3) return [];
  const celdas = (l: string) => l.trim().slice(1, -1).split("|").map((c) => c.trim());
  const encabezados = celdas(lineas[0]);
  const enTexto = numeros(texto);
  const descritos = hechos.filter((h) => h.enunciado.split(/\s+/).length >= 8).map((h) => numeros(h.enunciado));
  const igual = (a: number, b: number) => Math.abs(a - b) <= Math.abs(b) * 1e-9 + 1e-9;
  const out: { fila: string; columna: string; cifra: string }[] = [];
  for (const l of lineas.slice(2)) {
    const [fila, ...resto] = celdas(l);
    resto.forEach((c, i) => {
      // Un periodo («2026-2030») no es una cifra.
      if (/^\s*\d{4}\s*[-–]\s*\d{4}\s*$/.test(c)) return;
      const sueltas = numeros(c).filter((n) => !(Math.abs(n) < 10 || (Number.isInteger(Math.abs(n)) && Math.abs(n) >= 1900 && Math.abs(n) <= 2100)));
      const huerfana = sueltas.find((n) => !enTexto.some((x) => igual(x, n)) && !descritos.some((ns) => ns.some((x) => igual(x, n))));
      // Una nota por celda, aunque la celda traiga varias cifras.
      if (huerfana != null) out.push({ fila, columna: encabezados[i + 1] ?? "", cifra: c });
    });
  }
  return out;
}
