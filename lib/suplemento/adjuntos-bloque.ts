import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Contenido } from "@/lib/evidencias/extraer";
import { contenidoParaPrompt } from "@/lib/evidencias/fuente";
import { SECCION_DE_CAMPO } from "@/lib/suplemento/completitud";
import type { Bloque } from "@/lib/suplemento/bloques";
import type { FuenteEntregada } from "./prompt";

// =============================================================================
// DOCUMENTOS DEL PERFIL COMO CONTEXTO DEL BLOQUE — encargo suplemento-calidad,
// Paso 2.
//
// Los adjuntos del Perfil del emisor (estatutos, código de ética, actas,
// organigrama…) ya se leyeron en la cola (perfil_emisor_adjuntos_contenido).
// Aquí se decide QUÉ PARTE de ellos ve cada bloque:
//
//   1. Qué documentos: los de las secciones del Perfil que le tocan al bloque
//      (SECCIONES_POR_BLOQUE): las de sus campos del Perfil, y para gobernanza,
//      estrategia y gestión de riesgos las que tratan esos temas.
//   2. Qué partes: los documentos se cortan en unidades citables (una página de
//      PDF, un tramo de párrafos de Word, una hoja, una imagen) y se ordenan por
//      parecido con lo que el bloque tiene que cubrir —su título y sus
//      requisitos—. Entran las mejores hasta el tope de caracteres. Sin llamada
//      al modelo: es conteo de términos, cuesta cero y da lo mismo cada vez.
//   3. Cómo se citan: `adj:<adjunto>:p<N>` (página), `adj:<adjunto>:par<A>-<B>`
//      (párrafos), `adj:<adjunto>:tab<N>`, `adj:<adjunto>:h<N>`,
//      `adj:<adjunto>:img`, con un detalle legible: «estatutos.pdf, página 12».
//
// AISLAMIENTO: la consulta va acotada al tenant del documento, además de la
// RLS. El generador corre con la sesión del analista, que como staff ve todas
// las emisoras: la RLS sola no separaría a una de otra.
//
// LO QUE ESTO NO ES: una fuente de cifras. Igual que el contenido de las
// evidencias, el texto de un adjunto lo subió la emisora pero nadie confirmó sus
// números; el validador (cifras.ts) no lo cuenta como respaldo.
// =============================================================================

type Db = Awaited<ReturnType<typeof createClient>>;

/** Tope de caracteres de documentos por bloque, y por documento. */
const CARACTERES_POR_BLOQUE = 14000;
const CARACTERES_POR_DOCUMENTO = 8000;
/** Una unidad más larga que esto se recorta (una página de estatutos densa). */
const CARACTERES_POR_UNIDAD = 3500;
/** Tramo de párrafos de Word que forma una unidad citable. */
const CARACTERES_POR_TRAMO = 1800;

const GOBERNANZA = ["gobierno"];
const ESTRATEGIA = ["gobierno", "matriz", "horizontes", "modelo", "trayectoria"];
const RIESGOS = ["gobierno", "matriz"];

/** Secciones del Perfil cuyos documentos ve el bloque. Vacío = ninguno. */
export function seccionesDeAdjuntos(bloque: Bloque): string[] {
  const propias = bloque.perfil.map((c) => SECCION_DE_CAMPO[c]).filter((s): s is string => !!s);
  const tema = bloque.seccion.startsWith("II ")
    ? GOBERNANZA
    : bloque.seccion.startsWith("III ")
      ? ESTRATEGIA
      : bloque.seccion.startsWith("IV ")
        ? RIESGOS
        : [];
  return [...new Set([...propias, ...tema])];
}

type Unidad = { id: string; detalle: string; texto: string; orden: number };

function unidades(adjuntoId: string, archivo: string, c: Contenido): Unidad[] {
  const base = `adj:${adjuntoId}`;
  switch (c.tipo) {
    case "pdf":
      return c.paginas.map((p, i) => ({ id: `${base}:p${p.pagina}`, detalle: `${archivo}, página ${p.pagina}`, texto: p.texto, orden: i }));
    case "imagen":
      return [{ id: `${base}:img`, detalle: `${archivo} (imagen)`, texto: c.paginas.map((p) => p.texto).join("\n"), orden: 0 }];
    case "excel":
    case "csv":
      return c.hojas.map((h, i) => ({
        id: `${base}:h${i + 1}`,
        detalle: `${archivo}, hoja «${h.nombre}»`,
        texto: contenidoParaPrompt({ tipo: c.tipo, hojas: [h] }),
        orden: i,
      }));
    case "word": {
      // Los párrafos sueltos son demasiado cortos para puntuarlos: se juntan en
      // tramos consecutivos, y el tramo se cita por su primer y último párrafo.
      const out: Unidad[] = [];
      let tramo: { a: number; b: number; textos: string[] } | null = null;
      const cerrar = () => {
        if (!tramo) return;
        const r = tramo.a === tramo.b ? `${tramo.a}` : `${tramo.a}-${tramo.b}`;
        out.push({
          id: `${base}:par${r}`,
          detalle: `${archivo}, ${tramo.a === tramo.b ? "párrafo" : "párrafos"} ${tramo.a === tramo.b ? tramo.a : `${tramo.a} a ${tramo.b}`}`,
          texto: tramo.textos.join("\n"),
          orden: out.length,
        });
        tramo = null;
      };
      for (const b of c.bloques) {
        if (b.tipo === "tabla") {
          cerrar();
          out.push({ id: `${base}:tab${b.n}`, detalle: `${archivo}, tabla ${b.n}`, texto: b.filas.map((f) => f.join(" | ")).join("\n"), orden: out.length });
          continue;
        }
        if (!b.texto.trim()) continue;
        // Un título abre tramo nuevo: así el tramo es una cláusula o un capítulo.
        if (tramo && (b.titulo || tramo.textos.join("\n").length + b.texto.length > CARACTERES_POR_TRAMO)) cerrar();
        if (!tramo) tramo = { a: b.n, b: b.n, textos: [] };
        tramo.b = b.n;
        tramo.textos.push(b.texto);
      }
      cerrar();
      return out;
    }
  }
}

// -----------------------------------------------------------------------------
// Selección por parecido. Términos normalizados (sin acentos, minúsculas,
// recortados a sus primeras seis letras para juntar «comité/comités»,
// «supervisa/supervisión») ponderados por lo raros que son entre las unidades
// candidatas: «consejo» pesa poco en unos estatutos, «clima» mucho.
// -----------------------------------------------------------------------------
const VACIAS = new Set(
  "para como sobre entre desde hasta este esta estos estas cada cual cuales donde cuando debe deben puede pueden tiene tienen sera seran sido otra otro otros otras todo toda todos todas segun tambien ademas parte partes caso casos forma manera medida informacion entidad entidades revelar revela relacion relacionados relacionadas incluye incluido incluida cualquier dicha dicho dichos dichas mismo misma mismos".split(" ")
);

function terminos(texto: string): string[] {
  return (texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z]{4,}/g) ?? [])
    .filter((t) => !VACIAS.has(t))
    .map((t) => t.slice(0, 6));
}

function puntuar(consulta: string, us: Unidad[]): number[] {
  const q = new Set(terminos(consulta));
  const conjuntos = us.map((u) => new Set(terminos(u.texto)));
  const df = new Map<string, number>();
  for (const s of conjuntos) for (const t of s) if (q.has(t)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = us.length;
  return conjuntos.map((s) => {
    let p = 0;
    for (const t of q) if (s.has(t)) p += Math.log(1 + n / (df.get(t) ?? 1));
    // Normaliza por longitud con raíz: una página larga no gana solo por larga.
    return p / Math.sqrt(Math.max(1, s.size) / 50);
  });
}

export type DocumentoDelBloque = {
  adjuntoId: string;
  archivo: string;
  seccion: string;
  paginas: number | null;
  truncado: boolean;
  /** Unidades entregadas, en el orden del documento. */
  partes: { id: string; detalle: string; texto: string }[];
  /** Cuántas unidades tenía el documento y cuántas entraron. */
  unidades: number;
};

export type DocumentoSinLeer = { archivo: string; seccion: string; estado: string; mensaje: string | null };

export type AdjuntosDelBloque = {
  documentos: DocumentoDelBloque[];
  sinLeer: DocumentoSinLeer[];
  fuentes: FuenteEntregada[];
  /** Secciones con al menos un documento leído (las que pueden redactar un campo vacío). */
  seccionesLeidas: Set<string>;
  /** Secciones con documentos que todavía están en la cola. */
  seccionesEnCola: Set<string>;
};

export async function cargarAdjuntosDelBloque(
  db: Db,
  tenantId: string,
  bloque: Bloque,
  consulta: string
): Promise<AdjuntosDelBloque> {
  const vacio: AdjuntosDelBloque = { documentos: [], sinLeer: [], fuentes: [], seccionesLeidas: new Set(), seccionesEnCola: new Set() };
  const secciones = seccionesDeAdjuntos(bloque);
  if (!secciones.length) return vacio;

  const { data: filas } = await db
    .from("perfil_emisor_adjuntos_contenido")
    .select("adjunto_id, tenant_id, seccion, nombre_original, estado, contenido, paginas, truncado, mensaje, error, created_at")
    .eq("tenant_id", tenantId)
    .in("seccion", secciones)
    .order("created_at", { ascending: true });

  const r = vacio;
  type Candidata = Unidad & { doc: number };
  const candidatas: Candidata[] = [];
  const docs: (DocumentoDelBloque & { propia: boolean })[] = [];
  const propias = new Set(bloque.perfil.map((c) => SECCION_DE_CAMPO[c]));

  for (const f of filas ?? []) {
    // Redundante con el filtro, a propósito: es la barrera entre emisoras.
    if (f.tenant_id !== tenantId) continue;
    if (f.estado !== "extraido" || !f.contenido) {
      if (f.estado === "pendiente" || f.estado === "procesando") r.seccionesEnCola.add(f.seccion);
      else r.sinLeer.push({ archivo: f.nombre_original, seccion: f.seccion, estado: f.estado, mensaje: f.mensaje ?? f.error ?? null });
      continue;
    }
    const us = unidades(f.adjunto_id, f.nombre_original, f.contenido as unknown as Contenido).filter((u) => u.texto.trim());
    if (!us.length) continue;
    r.seccionesLeidas.add(f.seccion);
    const i = docs.length;
    docs.push({
      adjuntoId: f.adjunto_id,
      archivo: f.nombre_original,
      seccion: f.seccion,
      paginas: f.paginas,
      truncado: f.truncado,
      partes: [],
      unidades: us.length,
      propia: propias.has(f.seccion),
    });
    for (const u of us) candidatas.push({ ...u, doc: i });
  }
  if (!candidatas.length) return r;

  const puntos = puntuar(consulta, candidatas);
  const orden = candidatas.map((c, i) => ({ c, p: puntos[i] })).sort((a, b) => b.p - a.p);

  // Primero la mejor unidad de cada documento de una sección PROPIA del bloque:
  // si el campo del Perfil está vacío, ese documento es de donde se redacta, y
  // no puede quedarse fuera por puntuar bajo (un organigrama casi no tiene
  // palabras). Luego, todas por puntuación, con los topes.
  const elegidas = new Set<Candidata>();
  let restante = CARACTERES_POR_BLOQUE;
  const usadoPorDoc = new Map<number, number>();
  const tomar = (c: Candidata) => {
    const largo = Math.min(c.texto.length, CARACTERES_POR_UNIDAD);
    const usado = usadoPorDoc.get(c.doc) ?? 0;
    if (elegidas.has(c) || largo > restante || usado + largo > CARACTERES_POR_DOCUMENTO) return;
    elegidas.add(c);
    restante -= largo;
    usadoPorDoc.set(c.doc, usado + largo);
  };
  for (let d = 0; d < docs.length; d++) {
    if (!docs[d].propia) continue;
    const mejor = orden.find((o) => o.c.doc === d);
    if (mejor) tomar(mejor.c);
  }
  for (const o of orden) if (o.p > 0) tomar(o.c);

  for (const c of [...elegidas].sort((a, b) => a.doc - b.doc || a.orden - b.orden)) {
    const texto = c.texto.length > CARACTERES_POR_UNIDAD ? c.texto.slice(0, CARACTERES_POR_UNIDAD) + " […]" : c.texto;
    docs[c.doc].partes.push({ id: c.id, detalle: c.detalle, texto });
    r.fuentes.push({ id: c.id, tipo: "documento", detalle: c.detalle });
  }
  r.documentos = docs
    .filter((d) => d.partes.length)
    .map((d) => ({ adjuntoId: d.adjuntoId, archivo: d.archivo, seccion: d.seccion, paginas: d.paginas, truncado: d.truncado, partes: d.partes, unidades: d.unidades }));
  return r;
}

/** Los documentos en markdown para la capa volátil del prompt. */
export function documentosParaPrompt(a: AdjuntosDelBloque): string | null {
  if (!a.documentos.length && !a.sinLeer.length) return null;
  const partes: string[] = [];
  for (const d of a.documentos) {
    const leido = d.truncado && d.paginas ? ` Se leyeron las primeras páginas de ${d.paginas}.` : "";
    partes.push(
      `## ${d.archivo} (sección «${d.seccion}» del Perfil; ${d.partes.length} de ${d.unidades} partes, las más pertinentes a este bloque.${leido})`,
      "",
      ...d.partes.flatMap((p) => [`[${p.id}] ${p.detalle}`, p.texto, ""])
    );
  }
  if (a.sinLeer.length) {
    partes.push(
      "## Documentos que no se pudieron leer",
      "",
      ...a.sinLeer.map((s) => `- ${s.archivo} (sección «${s.seccion}»): ${s.mensaje ?? s.estado}`),
      ""
    );
  }
  return partes.join("\n");
}
