import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Contenido } from "@/lib/evidencias/extraer";
import { contenidoParaPrompt, type Fuente } from "@/lib/evidencias/fuente";
import type { FuenteEntregada } from "./prompt";

// =============================================================================
// EVIDENCIAS COMO CONTEXTO DEL BLOQUE — captura sugerida, Paso 5.
//
// Para cada solicitud del bloque, el contenido YA EXTRAÍDO de su evidencia más
// reciente (evidencias_contenido; no se vuelve a leer el archivo) y, si la hay,
// el extracto de texto que una persona confirmó (sugerencias_captura).
//
// Cada unidad citable recibe un id de fuente, el mismo que el modelo puede poner
// en `fuentes_usadas`:
//   evi:<evidencia>:p<N>      página N de un PDF
//   evi:<evidencia>:img       una imagen
//   evi:<evidencia>:par<N>    párrafo N de un Word
//   evi:<evidencia>:tab<N>    tabla N de un Word
//   evi:<evidencia>:h<N>      hoja N de un libro (en el orden del libro)
// con un `detalle` legible: «archivo.pdf, página 2».
//
// LO QUE ESTO NO ES: una fuente de cifras. El contenido crudo es contexto —sirve
// para describir procesos y decir de dónde viene algo—; las cifras del texto
// solo pueden salir de las capturas confirmadas y de los demás datos entregados.
// Lo hace cumplir el validador (cifras.ts), que NO cuenta el contenido crudo
// como corpus permitido. El extracto confirmado sí cuenta: lo respaldó una persona.
// =============================================================================

type Db = Awaited<ReturnType<typeof createClient>>;

/** Tope de caracteres de contenido crudo por evidencia y por bloque (costo y foco). */
const CARACTERES_POR_EVIDENCIA = 8000;
const CARACTERES_POR_BLOQUE = 30000;

export type EvidenciaDelBloque = {
  evidenciaId: string;
  archivo: string;
  version: number;
  /** Texto con un encabezado `[id]` por unidad citable, recortado al tope. */
  contenido: string;
  recortado: boolean;
  /** Extracto confirmado o corregido por una persona, con sus ids. */
  extractoConfirmado: null | { texto: string; corregido: boolean; citarCon: string[] };
};

function unidad(evidenciaId: string, f: Fuente | null | undefined, hojas: string[]): string | null {
  if (!f) return null;
  const base = `evi:${evidenciaId}`;
  switch (f.tipo) {
    case "pagina": return f.pagina ? `${base}:p${f.pagina}` : null;
    case "imagen": return `${base}:img`;
    case "parrafo": return f.parrafo ? `${base}:par${f.parrafo}` : null;
    case "tabla": return f.tabla ? `${base}:tab${f.tabla}` : null;
    case "celda": {
      const i = hojas.indexOf(String(f.hoja ?? ""));
      return i >= 0 ? `${base}:h${i + 1}` : null;
    }
  }
}

/** Unidades citables del contenido, en orden, cada una con su texto. */
function unidades(evidenciaId: string, archivo: string, c: Contenido): { id: string; detalle: string; texto: string }[] {
  const base = `evi:${evidenciaId}`;
  switch (c.tipo) {
    case "pdf":
      return c.paginas.map((p) => ({ id: `${base}:p${p.pagina}`, detalle: `${archivo}, página ${p.pagina}`, texto: p.texto }));
    case "imagen":
      return [{ id: `${base}:img`, detalle: `${archivo} (imagen)`, texto: c.paginas.map((p) => p.texto).join("\n") }];
    case "word":
      return c.bloques.map((b) =>
        b.tipo === "parrafo"
          ? { id: `${base}:par${b.n}`, detalle: `${archivo}, párrafo ${b.n}`, texto: b.texto }
          : { id: `${base}:tab${b.n}`, detalle: `${archivo}, tabla ${b.n}`, texto: b.filas.map((f) => f.join(" | ")).join("\n") }
      );
    case "excel":
    case "csv":
      return c.hojas.map((h, i) => ({
        id: `${base}:h${i + 1}`,
        detalle: `${archivo}, hoja «${h.nombre}»`,
        texto: contenidoParaPrompt({ tipo: c.tipo, hojas: [h] }),
      }));
  }
}

export async function cargarEvidenciasDelBloque(
  db: Db,
  solicitudIds: string[]
): Promise<{ porSolicitud: Map<string, EvidenciaDelBloque>; fuentes: FuenteEntregada[] }> {
  const porSolicitud = new Map<string, EvidenciaDelBloque>();
  const fuentes: FuenteEntregada[] = [];
  if (!solicitudIds.length) return { porSolicitud, fuentes };

  const [{ data: conts }, { data: textos }] = await Promise.all([
    db
      .from("evidencias_contenido")
      .select("solicitud_id, evidencia_id, version, nombre_original, contenido")
      .in("solicitud_id", solicitudIds)
      .eq("estado", "extraido")
      .order("version", { ascending: false }),
    db
      .from("sugerencias_captura")
      .select("solicitud_id, evidencia_id, estado, extracto, extracto_final, fuente, decidido_en")
      .in("solicitud_id", solicitudIds)
      .eq("tipo", "texto")
      .in("estado", ["confirmada", "corregida"])
      .order("decidido_en", { ascending: false }),
  ]);

  let restante = CARACTERES_POR_BLOQUE;
  for (const fila of conts ?? []) {
    if (porSolicitud.has(fila.solicitud_id) || !fila.contenido) continue; // solo la versión más reciente
    const c = fila.contenido as unknown as Contenido;
    const hojas = c.tipo === "excel" || c.tipo === "csv" ? c.hojas.map((h) => h.nombre) : [];
    const us = unidades(fila.evidencia_id, fila.nombre_original, c);

    let tope = Math.min(CARACTERES_POR_EVIDENCIA, restante);
    const partes: string[] = [];
    let recortado = false;
    for (const u of us) {
      const bloque = `[${u.id}] ${u.detalle}\n${u.texto}`;
      if (bloque.length > tope) {
        if (tope > 200) partes.push(bloque.slice(0, tope) + " […]");
        recortado = true;
        fuentes.push({ id: u.id, tipo: "evidencia", detalle: u.detalle });
        break;
      }
      partes.push(bloque);
      tope -= bloque.length;
      fuentes.push({ id: u.id, tipo: "evidencia", detalle: u.detalle });
    }
    const contenido = partes.join("\n\n");
    restante -= contenido.length;

    // Extracto confirmado de ESTA evidencia (el de una versión anterior ya no aplica).
    const t = (textos ?? []).find((x) => x.solicitud_id === fila.solicitud_id && x.evidencia_id === fila.evidencia_id);
    let extractoConfirmado: EvidenciaDelBloque["extractoConfirmado"] = null;
    if (t) {
      const frags = ((t.fuente as unknown as { fragmentos?: { fuente: Fuente }[] } | null)?.fragmentos ?? []);
      const citarCon = [...new Set(frags.map((f) => unidad(fila.evidencia_id, f.fuente, hojas)).filter((x): x is string => !!x))];
      for (const id of citarCon) {
        if (!fuentes.some((f) => f.id === id)) {
          const u = us.find((x) => x.id === id);
          fuentes.push({ id, tipo: "evidencia", detalle: u?.detalle ?? fila.nombre_original });
        }
      }
      const corregido = t.estado === "corregida" && !!t.extracto_final;
      extractoConfirmado = { texto: (corregido ? t.extracto_final : t.extracto) ?? "", corregido, citarCon };
    }

    porSolicitud.set(fila.solicitud_id, {
      evidenciaId: fila.evidencia_id,
      archivo: fila.nombre_original,
      version: fila.version,
      contenido,
      recortado,
      extractoConfirmado,
    });
  }
  return { porSolicitud, fuentes };
}

// -----------------------------------------------------------------------------
// RESPALDO DE CADA CIFRA CONFIRMADA
//
// La cifra que el ensamblador entrega para una solicitud es su última captura
// confirmada del ejercicio. Si esa captura nació de una sugerencia (origen
// «sugerida»), la sugerencia sabe de qué archivo y de qué lugar exacto salió:
// hoja y celda, página, tabla o párrafo. Ese lugar es el respaldo de la cifra, y
// se cita en `fuentes_usadas` siempre que el bloque cite la solicitud —lo agrega
// el código, no depende de que el modelo se acuerde—. Una captura manual solo
// conoce su archivo: se cita el archivo, sin lugar.
// -----------------------------------------------------------------------------

export type RespaldoDeCifra = { id: string; detalle: string };

export async function respaldoDeCifras(
  db: Db,
  solicitudIds: string[],
  ejercicio: number
): Promise<{ porSolicitud: Map<string, RespaldoDeCifra>; fuentes: FuenteEntregada[] }> {
  const porSolicitud = new Map<string, RespaldoDeCifra>();
  if (!solicitudIds.length) return { porSolicitud, fuentes: [] };
  const { data: caps } = await db
    .from("capturas_valor")
    .select("solicitud_id, evidencia_id, sugerencia_id, created_at")
    .in("solicitud_id", solicitudIds)
    .eq("confirmado", true)
    .eq("periodo", String(ejercicio))
    .order("created_at", { ascending: false });
  const ultima = new Map<string, { evidencia_id: string; sugerencia_id: string | null }>();
  for (const c of caps ?? []) if (!ultima.has(c.solicitud_id)) ultima.set(c.solicitud_id, c);
  if (!ultima.size) return { porSolicitud, fuentes: [] };

  const sugIds = [...ultima.values()].map((c) => c.sugerencia_id).filter((x): x is string => !!x);
  const evIds = [...new Set([...ultima.values()].map((c) => c.evidencia_id))];
  const [{ data: sugs }, { data: evs }, { data: conts }] = await Promise.all([
    sugIds.length ? db.from("sugerencias_captura").select("id, fuente").in("id", sugIds) : Promise.resolve({ data: [] as { id: string; fuente: unknown }[] }),
    db.from("evidencias").select("id, nombre_original").in("id", evIds),
    db.from("evidencias_contenido").select("evidencia_id, contenido").in("evidencia_id", evIds),
  ]);
  const nombre = new Map((evs ?? []).map((e) => [e.id, e.nombre_original]));
  const hojasDe = new Map((conts ?? []).map((c) => {
    const ct = c.contenido as unknown as Contenido | null;
    return [c.evidencia_id, ct && (ct.tipo === "excel" || ct.tipo === "csv") ? ct.hojas.map((h) => h.nombre) : []];
  }));

  for (const [sol, c] of ultima) {
    const archivo = nombre.get(c.evidencia_id) ?? "archivo";
    const base = `evi:${c.evidencia_id}`;
    const f = (sugs ?? []).find((s) => s.id === c.sugerencia_id)?.fuente as Fuente | undefined;
    let r: RespaldoDeCifra = { id: base, detalle: archivo };
    if (f?.tipo === "celda") {
      const i = (hojasDe.get(c.evidencia_id) ?? []).indexOf(String(f.hoja));
      if (i >= 0) r = { id: `${base}:h${i + 1}!${f.celda}`, detalle: `${archivo}, hoja «${f.hoja}», celda ${f.celda}` };
    } else if (f?.tipo === "pagina" && f.pagina) {
      r = { id: `${base}:p${f.pagina}`, detalle: `${archivo}, página ${f.pagina}` };
    } else if (f?.tipo === "tabla" && f.tabla) {
      // Id propio con fila y columna: `tab<N>` ya es la tabla entera como unidad de contenido.
      r = { id: `${base}:tab${f.tabla}f${f.fila}c${f.columna}`, detalle: `${archivo}, tabla ${f.tabla}, fila ${f.fila}, columna ${f.columna}` };
    } else if (f?.tipo === "parrafo" && f.parrafo) {
      r = { id: `${base}:par${f.parrafo}`, detalle: `${archivo}, párrafo ${f.parrafo}` };
    } else if (f?.tipo === "imagen") {
      r = { id: `${base}:img`, detalle: `${archivo} (imagen)` };
    }
    porSolicitud.set(sol, r);
  }
  const fuentes = [...new Map([...porSolicitud.values()].map((r) => [r.id, { id: r.id, tipo: "evidencia" as const, detalle: r.detalle }])).values()];
  return { porSolicitud, fuentes };
}
