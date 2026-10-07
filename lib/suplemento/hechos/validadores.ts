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
