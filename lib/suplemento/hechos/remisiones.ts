// =============================================================================
// REMISIONES (Paso 5b, corrección aprobada el 7 de octubre de 2026).
//
// Un bloque solo remite a otro si ese otro es DUEÑO del hecho remitido y lo
// afirma en su texto; si no, el contenido se redacta en el propio bloque o va a
// pendiente. Sin modelo:
//   1. cada oración se parte en cláusulas («X se describe en la sección de A, y
//      Y en la sección de B»);
//   2. el destino se resuelve por el título del bloque (contenido literal del
//      título, o la mayoría de sus palabras); si es ambiguo, no se juzga;
//   3. el contenido remitido (lo que va antes del verbo) tiene que coincidir en
//      al menos dos palabras con un hecho cuyo dueño es el destino y que el
//      destino ancla en su texto.
// =============================================================================

export type BloqueTitulo = { numero: number; titulo: string };
export type HechoDelLibro = { id: string; dueno: number | null; enunciado: string; narrativo?: boolean };
export type Remision = {
  bloque: number;
  destino: number;
  clausula: string;
  contenido: string;
  motivo: "destino_ausente" | "remite_a_pendiente" | "otro_dueno" | "destino_no_lo_afirma";
  /** Dueño del hecho remitido, si se identificó. */
  dueno: number | null;
};

const VACIAS = new Set(
  "para como sobre entre desde hasta este esta estos estas cada otro otra otros otras donde cual cuales cuando sean sido será serán tiene tienen debe deben tanto según mediante durante ante bajo cuyo cuya cuyos cuyas sino también además así forma manera compañía emisora entidad describe describen presenta presentan detalla detallan sección secciones apartado correspondiente correspondientes relativa relacionados relacionadas relacionado relacionada clima climáticos climáticas climático climática riesgos oportunidades".split(" ")
);

export function palabrasDe(t: string): Set<string> {
  return new Set(
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9ñ]+/)
      .filter((w) => w.length >= 4 && !VACIAS.has(w))
  );
}
const plano = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

const DESTINO = /secci[oó]n(?:es)?\s+(?:de\s+|sobre\s+|relativa\s+a\s+|dedicada\s+a\s+)?(?:la\s+|el\s+|los\s+|las\s+)?([^;]+?)\.?$/i;
/** Órganos y nombres genéricos de gobierno: aparecen en casi todo y no distinguen contenidos. */
const ORGANOS = ["consejo", "administracion", "comite", "comites", "direccion", "direcciones", "sostenibilidad", "general", "gobierno", "organo", "organos", "gerencia"];

/** Destinos genéricos («las secciones correspondientes»): no apuntan a un bloque. */
const GENERICO = /^(?:correspondientes?|respectivas?)\b|\bcorrespondientes?\.?$/i;
/** Fin de oración: no corta en «S.A.B. de C.V.» ni en siglas. */
export const FIN_ORACION = /(?<=[a-záéíóúñ0-9)»\]]\.)\s+(?=[«(¿¡]?[A-ZÁÉÍÓÚÑ])/u;
const VERBO = /\b(?:se (?:describen?|presentan?|detallan?|explican?|indican?|desarrollan?)|como se describe|corresponden? a la secci[oó]n|en la secci[oó]n|en las secciones)\b/i;

/** El bloque al que apunta un texto de destino, o null si no es inequívoco. */
export function destinoDe(texto: string, bloques: BloqueTitulo[], propio: number): number | null {
  if (GENERICO.test(texto.trim())) return null;
  const t = plano(texto);
  const literales = bloques.filter((b) => b.numero !== propio && t.includes(plano(b.titulo.replace(/\(.*?\)/g, "")).slice(0, 40)));
  if (literales.length === 1) return literales[0].numero;
  const w = palabrasDe(texto);
  const puntos = bloques
    .filter((b) => b.numero !== propio)
    .map((b) => {
      const tw = palabrasDe(b.titulo.replace(/\(.*?\)/g, ""));
      const comunes = [...tw].filter((x) => w.has(x)).length;
      return { n: b.numero, comunes, prop: tw.size ? comunes / tw.size : 0 };
    })
    // Un título de una sola palabra de contenido no se adivina por esa palabra.
    .filter((p) => p.comunes >= 2 && p.prop >= 0.5)
    .sort((a, b) => b.prop - a.prop || b.comunes - a.comunes);
  if (!puntos.length) return null;
  if (puntos.length > 1 && puntos[1].prop === puntos[0].prop && puntos[1].comunes === puntos[0].comunes) return null;
  return puntos[0].n;
}

/** Cláusulas de una oración que remiten, con su contenido y su texto de destino. */
export function clausulas(oracion: string): { clausula: string; contenido: string; destino: string }[] {
  const out: { clausula: string; contenido: string; destino: string }[] = [];
  for (const c of oracion.split(/;\s+|,\s+y\s+(?=(?:la|el|los|las|lo)\s)/)) {
    const v = c.match(VERBO);
    const d = c.match(DESTINO);
    if (!v || !d) continue;
    out.push({ clausula: c.trim(), contenido: c.slice(0, v.index).trim(), destino: d[1].trim() });
  }
  return out;
}

/**
 * Remisiones que no se sostienen. Se juzga una cláusula solo si su contenido
 * (sin las palabras del título del destino) coincide con claridad con un hecho
 * vigente del libro —al menos dos palabras y la mitad del contenido—: con
 * sinónimos o contenidos vagos no hay forma de saber qué se remite, y un falso
 * positivo cuesta un reintento y empeora el texto.
 *   · destino_ausente: el destino no está en el documento;
 *   · remite_a_pendiente: el destino deja ese contenido como pendiente;
 *   · otro_dueno: el hecho es de otro bloque (incluido el propio);
 *   · destino_no_lo_afirma: el destino es dueño pero no lo dice en su texto.
 */
export function remisionesSinDueno(
  textos: { numero: number; texto: string }[],
  bloques: BloqueTitulo[],
  presentes: Set<number>,
  hechos: HechoDelLibro[],
  anclados: Map<number, Set<string>>,
  /** Nombres de la emisora y de sus órganos (glosario): no dicen QUÉ se remite. */
  nombres: string[] = []
): Remision[] {
  const out: Remision[] = [];
  const ignorar = new Set([...nombres.flatMap((n) => [...palabrasDe(n)]), ...ORGANOS]);
  const sin = (w: Set<string>) => new Set([...w].filter((x) => !ignorar.has(x)));
  // La Carta no es dueña de nada que se pueda remitir.
  const conPalabras = hechos.filter((h) => !h.narrativo).map((h) => ({ ...h, w: sin(palabrasDe(h.enunciado)) }));
  const pendientesDe = new Map(textos.map((t) => [t.numero, [...t.texto.matchAll(/\[Pendiente:([^\]]*)\]/g)].map((m) => sin(palabrasDe(m[1].split("—")[0])))]));
  // Lo que cada bloque desarrolla: sus oraciones, sin pendientes y sin sus propias remisiones.
  const desarrolla = new Map(
    textos.map((t) => [
      t.numero,
      t.texto
        .replace(/\[Pendiente:[^\]]*\]/g, " ")
        .split(FIN_ORACION)
        .filter((o) => !clausulas(o).length)
        .map((o) => sin(palabrasDe(o))),
    ])
  );
  for (const b of textos) {
    for (const o of b.texto.replace(/\[Pendiente:[^\]]*\]/g, " ").split(FIN_ORACION)) {
      for (const c of clausulas(o)) {
        const destino = destinoDe(c.destino, bloques, b.numero);
        if (destino == null) continue;
        const base = { bloque: b.numero, destino, clausula: c.clausula, contenido: c.contenido };
        if (!presentes.has(destino)) {
          out.push({ ...base, motivo: "destino_ausente", dueno: null });
          continue;
        }
        const titulo = palabrasDe(bloques.find((x) => x.numero === destino)?.titulo ?? "");
        const que = new Set([...sin(palabrasDe(c.contenido))].filter((w) => !titulo.has(w)));
        if (que.size < 2) continue;
        const coincide = (w: Set<string>, proporcion = 0.5) => {
          const n = [...que].filter((x) => w.has(x)).length;
          return n >= 2 && n / que.size >= proporcion ? n : 0;
        };
        // El destino lo desarrolla en su texto (también en una tabla armada por código): vale.
        const enDestino = Math.max(0, ...(desarrolla.get(destino) ?? []).map((w) => coincide(w, 0.6)));
        if ((pendientesDe.get(destino) ?? []).some((w) => coincide(w) > enDestino)) {
          out.push({ ...base, motivo: "remite_a_pendiente", dueno: null });
          continue;
        }
        if (enDestino) continue;
        const mejor = conPalabras
          .map((h) => ({ h, n: coincide(h.w) }))
          .filter((x) => x.n > 0)
          .sort((x, y) => y.n - x.n)[0];
        if (!mejor) continue;
        // Si el destino es dueño de algún hecho igual de cercano, la remisión vale.
        const delDestino = conPalabras.filter((h) => h.dueno === destino && coincide(h.w) >= mejor.n);
        if (delDestino.length) {
          if (!delDestino.some((h) => anclados.get(destino)?.has(h.id))) out.push({ ...base, motivo: "destino_no_lo_afirma", dueno: destino });
          continue;
        }
        out.push({ ...base, motivo: "otro_dueno", dueno: mejor.h.dueno });
      }
    }
  }
  return out;
}
