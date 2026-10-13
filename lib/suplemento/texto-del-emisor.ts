import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Contenido } from "@/lib/evidencias/extraer";
import { SECCION_DE_CAMPO } from "@/lib/suplemento/completitud";
import { BLOQUES, esEditorial, type Bloque } from "@/lib/suplemento/bloques";

// =============================================================================
// TEXTO DEL EMISOR SIN REESCRIBIR — encargo suplemento-calidad, Paso 3 (c).
//
// En un bloque EDITORIAL se puede elegir un adjunto del Perfil y usar su texto
// tal cual: el bloque lleva el contenido literal del archivo, con su cita, sin
// pasar por el modelo. Es el tratamiento «texto ya redactado» de §3.2 de la
// especificación: una carta firmada o una historia que el emisor ya escribió
// no se resume ni se parafrasea.
//
// QUÉ SE PERMITE: solo editoriales (los normativos responden a un requisito y
// los redacta el generador), solo adjuntos de las secciones del Perfil del
// propio bloque, solo PDF o Word ya leídos y sin recortar, y hasta
// CARACTERES_MAX. Lo demás no aparece como opción y la ruta lo rechaza.
//
// QUÉ SE HACE CON EL TEXTO: nada que cambie palabras. En un Word, cada párrafo
// es una línea, los títulos van como **título** y las tablas como tabla (el
// exportador a Word las reconstruye). En un PDF solo se rehacen los párrafos
// que el ancho de página cortó en líneas: una línea casi tan larga como la más
// larga de la página continúa en la siguiente; una corta cierra el párrafo.
// =============================================================================

type Db = Awaited<ReturnType<typeof createClient>>;

/** Más que esto no es un bloque editorial: es un documento entero pegado. */
export const CARACTERES_MAX = 20000;

/** Secciones del Perfil cuyos adjuntos puede usar literalmente un bloque. */
export function seccionesLiterales(bloque: Bloque): string[] {
  if (!esEditorial(bloque)) return [];
  return [...new Set(bloque.perfil.map((c) => SECCION_DE_CAMPO[c]).filter((s): s is string => !!s))];
}

export type OpcionLiteral = { adjuntoId: string; archivo: string; seccion: string; caracteres: number };

type FilaContenido = {
  adjunto_id: string;
  tenant_id: string;
  seccion: string;
  nombre_original: string;
  tipo: string | null;
  estado: string;
  truncado: boolean;
  contenido: unknown;
};

function apta(f: FilaContenido): boolean {
  return f.estado === "extraido" && !f.truncado && (f.tipo === "pdf" || f.tipo === "word") && !!f.contenido;
}

/** Por clave de bloque editorial, los adjuntos que puede usar literalmente. */
export async function opcionesLiterales(db: Db, tenantId: string): Promise<Record<string, OpcionLiteral[]>> {
  const { data } = await db
    .from("perfil_emisor_adjuntos_contenido")
    .select("adjunto_id, tenant_id, seccion, nombre_original, tipo, estado, truncado, contenido")
    .eq("tenant_id", tenantId)
    // Solo lo que puede ser opción: no baja el contenido de lo que no sirve.
    .eq("estado", "extraido")
    .eq("truncado", false)
    .in("tipo", ["pdf", "word"])
    .order("created_at", { ascending: true });
  const filas = ((data ?? []) as FilaContenido[]).filter((f) => f.tenant_id === tenantId && apta(f));
  const out: Record<string, OpcionLiteral[]> = {};
  for (const b of BLOQUES) {
    const secciones = seccionesLiterales(b);
    if (!secciones.length) continue;
    const ops = filas
      .filter((f) => secciones.includes(f.seccion))
      .map((f) => ({ f, t: textoLiteral(f.adjunto_id, f.nombre_original, f.contenido as Contenido) }))
      .filter(({ t }) => t.ok)
      .map(({ f, t }) => ({ adjuntoId: f.adjunto_id, archivo: f.nombre_original, seccion: f.seccion, caracteres: t.ok ? t.texto.length : 0 }));
    if (ops.length) out[b.clave] = ops;
  }
  return out;
}

export type Literal =
  | { ok: true; texto: string; fuentes: { tipo: "documento"; id: string; detalle: string }[] }
  | { ok: false; error: string };

/** Párrafos de una página de PDF, rehechos sin tocar palabras. */
function parrafosDePagina(texto: string): string[] {
  const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lineas.length) return [];
  const ancho = Math.max(...lineas.map((l) => l.length));
  const parrafos: string[] = [];
  let actual: string[] = [];
  for (const l of lineas) {
    actual.push(l);
    // Una línea corta cierra el párrafo (o es un título, que va solo).
    if (l.length < ancho * 0.75) {
      parrafos.push(actual.join(" "));
      actual = [];
    }
  }
  if (actual.length) parrafos.push(actual.join(" "));
  return parrafos;
}

export function textoLiteral(adjuntoId: string, archivo: string, c: Contenido): Literal {
  const base = `adj:${adjuntoId}`;
  const lineas: string[] = [];
  let fuentes: { tipo: "documento"; id: string; detalle: string }[] = [];
  if (c.tipo === "word") {
    for (const b of c.bloques) {
      if (b.tipo === "parrafo") {
        if (!b.texto.trim()) continue;
        lineas.push(b.titulo ? `**${b.texto.trim()}**` : b.texto.trim());
      } else if (b.filas.length) {
        const fila = (f: string[]) => `| ${f.map((x) => x.replace(/\|/g, "/").trim()).join(" | ")} |`;
        lineas.push("", fila(b.filas[0]), `|${b.filas[0].map(() => " --- ").join("|")}|`, ...b.filas.slice(1).map(fila), "");
      }
    }
    const n = c.bloques.filter((b) => b.tipo === "parrafo").length;
    fuentes = [{ tipo: "documento", id: `${base}:par1-${n}`, detalle: `${archivo}, texto completo (párrafos 1 a ${n}), sin reescribir` }];
  } else if (c.tipo === "pdf") {
    for (const p of c.paginas) lineas.push(...parrafosDePagina(p.texto));
    fuentes = c.paginas.map((p) => ({ tipo: "documento" as const, id: `${base}:p${p.pagina}`, detalle: `${archivo}, página ${p.pagina}, sin reescribir` }));
  } else {
    return { ok: false, error: "Solo se usa literalmente un PDF o un Word." };
  }
  // Los párrafos van separados por una línea en blanco, como el resto de los bloques.
  const texto = lineas.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!texto) return { ok: false, error: `${archivo} no tiene texto que copiar.` };
  if (texto.length > CARACTERES_MAX) {
    return { ok: false, error: `${archivo} tiene ${texto.length.toLocaleString("es-MX")} caracteres; el texto literal de un bloque admite hasta ${CARACTERES_MAX.toLocaleString("es-MX")}.` };
  }
  return { ok: true, texto, fuentes };
}

/**
 * El texto literal del adjunto elegido para el bloque. Acotado al tenant del
 * documento (además de la RLS: el staff ve todas las emisoras) y a las
 * secciones del bloque.
 */
export async function cargarLiteral(db: Db, tenantId: string, bloque: Bloque, adjuntoId: string): Promise<Literal & { archivo?: string }> {
  const { data } = await db
    .from("perfil_emisor_adjuntos_contenido")
    .select("adjunto_id, tenant_id, seccion, nombre_original, tipo, estado, truncado, contenido")
    .eq("adjunto_id", adjuntoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const f = data as FilaContenido | null;
  if (!f || f.tenant_id !== tenantId) return { ok: false, error: "El archivo elegido ya no está en el Perfil de esta emisora." };
  if (!seccionesLiterales(bloque).includes(f.seccion)) return { ok: false, error: `${f.nombre_original} no es de una sección de este bloque.` };
  if (!apta(f)) {
    return { ok: false, error: f.truncado ? `${f.nombre_original} se leyó recortado; no se puede copiar entero.` : `${f.nombre_original} no está leído como PDF o Word.` };
  }
  return { ...textoLiteral(f.adjunto_id, f.nombre_original, f.contenido as Contenido), archivo: f.nombre_original };
}
