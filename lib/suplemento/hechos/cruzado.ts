import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES } from "@/lib/suplemento/bloques";
import { PLANTILLAS } from "@/lib/suplemento/plantillas";
import { numerosDe } from "@/lib/evidencias/fuente";
import { leerGlosario } from "@/lib/suplemento/glosario";
import { remisionesSinDueno } from "./remisiones";
import { esCambioDelEjercicio, SIN_CAMBIOS } from "./validadores";

// =============================================================================
// VALIDADOR CRUZADO SOBRE EL LIBRO (Paso 5b, segunda revisión externa, punto 1).
//
// «Una sección dice que el Comité fue creado el 27 de febrero y otra dice que no
// se sabe si existe.» Cada bloque razona sobre sus hechos sin ver lo que
// afirman los demás; aquí, después de generar el documento y sin modelo, se
// comprueba con las anclas de cada bloque (qué hecho sostiene cada oración):
//
//   · pendiente_de_afirmado: un bloque deja pendiente algo que otro bloque
//     afirma con un hecho vigente del libro;
//   · otro_valor: dos bloques afirman hechos de la misma clave con cifras
//     distintas;
//   · afirma_excluyente: un bloque afirma un hecho que el libro dejó en
//     contradicción excluyente (debió ir como pendiente);
//   · remision_a_plantilla: un bloque remite a un bloque de plantilla (2, 3, 5,
//     14), que no desarrolla nada y no recibe remisiones (punto 12);
//   · remision_sin_dueno: un bloque remite a otro que no es dueño del hecho
//     remitido, que no lo afirma, que lo deja pendiente o que no está en el
//     documento (corrección aprobada al cerrar el 5b; remisiones.ts).
//
// Cada discrepancia trae la corrección sugerida. Desde el cierre del 5b NO se
// reintenta el bloque (los reintentos no convergían y costaban ~$2.60 por
// documento): las discrepancias van a la coherencia, destacadas y con enlace a
// los dos bloques. `opciones.correccion` sigue disponible para regenerar a mano.
// =============================================================================

type Db = SupabaseClient<Database>;

export type TipoDiscrepancia = "pendiente_de_afirmado" | "otro_valor" | "afirma_excluyente" | "remision_a_plantilla" | "remision_sin_dueno" | "cambios_negados";

export type Discrepancia = {
  bloque: number;
  tipo: TipoDiscrepancia;
  /** Bloque que afirma lo que aquí falta o difiere, si lo hay. */
  otroBloque: number | null;
  cita: string;
  detalle: string;
  /** La corrección sugerida (para regenerar a mano). */
  correccion: string;
  /** pendiente_de_afirmado: el marcador completo y si el otro bloque es DUEÑO del hecho que lo afirma. */
  marcador?: string;
  duenoAfirma?: boolean;
};

type AnclaGuardada = { oracion: string; hechos: { id: string; hecho: string | null; fuente: string }[] };

const VACIAS = new Set(
  "para como sobre entre desde hasta este esta estos estas cada otro otra otros otras donde cual cuales cuando sean sido será serán tiene tienen debe deben tanto según mediante durante ante bajo cuyo cuya cuyos cuyas sino también además fecha falta confirmar indicar precisar dato datos información documento documentos solicitud campo perfil emisora compañía entidad".split(" ")
);

function palabras(t: string): Set<string> {
  return new Set(
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9ñ]+/)
      .filter((w) => w.length >= 4 && !VACIAS.has(w))
  );
}

const RE_MARCADOR = /\[Pendiente:\s*([^\]—]+?)\s*(?:—[^\]]*)?\]/g;
const RE_REMISION = /(?:como se (?:describe|indica|detalla|señala|explica|presenta)|v[ée]ase|ver la secci[oó]n|en la secci[oó]n|en el apartado)[^.]{0,100}/gi;

export async function validarCruzado(db: Db, documentoId: string): Promise<Discrepancia[]> {
  const { data: filas } = await db
    .from("documentos_bloques")
    .select("numero, texto, anclas, cobertura, libro_id, texto_del_emisor, estado, documento:documentos_generados(tenant_id, reporte_id)")
    .eq("documento_id", documentoId)
    .order("numero");
  const bloques = (filas ?? []).filter((b) => b.texto && b.estado !== "no_aplica" && !b.texto_del_emisor);
  const libroId = bloques.find((b) => b.libro_id)?.libro_id;
  if (!libroId) return [];
  const { data: hs } = await db
    .from("hechos")
    .select("id, clave, enunciado, extracto, periodo, valor, unidad, estado, veredicto, grupo_conflicto, bloque_dueno, rango_fuente")
    .eq("libro_id", libroId);
  const hecho = new Map((hs ?? []).map((h) => [h.id, h]));
  const anclas = (b: (typeof bloques)[number]) => ((b.anclas ?? []) as unknown as AnclaGuardada[]);

  const out: Discrepancia[] = [];
  const plantillas = new Set(Object.keys(PLANTILLAS).map(Number));
  const tituloDe = (n: number) => BLOQUES.find((b) => b.numero === n)?.titulo ?? `bloque ${n}`;

  // Lo que cada bloque afirma: oración anclada → hechos del libro.
  const afirmado = bloques.flatMap((b) =>
    anclas(b).flatMap((a) =>
      a.hechos.filter((x) => x.hecho && hecho.has(x.hecho)).map((x) => ({ bloque: b.numero, oracion: a.oracion, h: hecho.get(x.hecho!)! }))
    )
  );

  for (const b of bloques) {
    // --- 1. Pendiente de lo que otro bloque afirma --------------------------
    for (const m of (b.texto ?? "").matchAll(RE_MARCADOR)) {
      // Solo el «qué falta»: la sugerencia de documento diluye la coincidencia.
      const que = palabras(m[1].replace(/\(documento sugerido[^)]*\)?/gi, " "));
      if (que.size < 2) continue;
      // Un pendiente que corresponde a una contradicción excluyente del propio
      // bloque es el pendiente correcto, no uno que otro bloque resuelva.
      const propioEnConflicto = Math.max(
        0,
        ...(hs ?? [])
          .filter((h) => h.estado === "en_conflicto" && afirmado.some((a) => a.bloque === b.numero && a.h.grupo_conflicto === h.grupo_conflicto))
          .map((h) => [...que].filter((w) => palabras(h.enunciado).has(w)).length)
      );
      let mejor: { a: (typeof afirmado)[number]; comunes: number } | null = null;
      for (const a of afirmado) {
        if (a.bloque === b.numero || a.h.estado !== "vigente") continue;
        const de = palabras(`${a.h.enunciado} ${a.oracion}`);
        const comunes = [...que].filter((w) => de.has(w)).length;
        if (comunes >= 3 && comunes / que.size >= 0.5 && (!mejor || comunes > mejor.comunes)) mejor = { a, comunes };
      }
      if (mejor && mejor.comunes > propioEnConflicto) {
        out.push({
          bloque: b.numero,
          tipo: "pendiente_de_afirmado",
          otroBloque: mejor.a.bloque,
          cita: m[0].slice(0, 200),
          detalle: `El bloque ${mejor.a.bloque} afirma «${mejor.a.oracion.slice(0, 200)}» con un hecho vigente del libro.`,
          marcador: m[0],
          duenoAfirma: mejor.a.h.bloque_dueno === mejor.a.bloque,
          correccion: `Dejaste pendiente «${m[1].trim()}», pero el bloque ${mejor.a.bloque} («${tituloDe(mejor.a.bloque)}») lo afirma con un hecho vigente del libro: «${mejor.a.h.enunciado}». No lo dejes pendiente: si tienes ese hecho entre los tuyos, afírmalo; si no, remite en una frase a esa sección.`,
        });
      }
    }

    // --- 3. Afirma lo que el libro dejó en contradicción excluyente -------------
    for (const a of afirmado.filter((x) => x.bloque === b.numero && x.h.estado === "en_conflicto")) {
      out.push({
        bloque: b.numero,
        tipo: "afirma_excluyente",
        otroBloque: null,
        cita: a.oracion.slice(0, 200),
        detalle: `Afirma un hecho que el libro dejó en contradicción excluyente: «${a.h.enunciado.slice(0, 160)}».`,
        correccion: `La oración «${a.oracion.slice(0, 200)}» afirma un hecho cuyo veredicto es «excluyente». No elijas versión: en su lugar va un marcador de pendiente y la nota de contradicción.`,
      });
    }

    // --- 4. Remisiones a bloques de plantilla --------------------------------
    const cobertura = (b.cobertura ?? []) as unknown as { codigo: string; estado: string; bloque: number | null }[];
    for (const c of cobertura.filter((x) => x.estado === "asignado" && x.bloque != null && plantillas.has(x.bloque))) {
      out.push({
        bloque: b.numero,
        tipo: "remision_a_plantilla",
        otroBloque: c.bloque,
        cita: c.codigo,
        detalle: `Asigna ${c.codigo} al bloque de plantilla ${c.bloque}.`,
        correccion: `Asignaste ${c.codigo} al bloque ${c.bloque} («${tituloDe(c.bloque!)}»), que es una plantilla fija y no desarrolla ese requisito. Respóndelo aquí o márcalo pendiente.`,
      });
    }
    if (!plantillas.has(b.numero)) {
      for (const m of (b.texto ?? "").matchAll(RE_REMISION)) {
        const n = [...plantillas].find((p) => m[0].toLowerCase().includes(tituloDe(p).toLowerCase()));
        if (n == null) continue;
        out.push({
          bloque: b.numero,
          tipo: "remision_a_plantilla",
          otroBloque: n,
          cita: m[0].slice(0, 200),
          detalle: `Remite al bloque de plantilla ${n} («${tituloDe(n)}»).`,
          correccion: `«${m[0].slice(0, 160)}» remite a «${tituloDe(n)}», una plantilla fija que no desarrolla ese contenido. Quita la remisión: di lo que corresponda con tus hechos o deja el pendiente.`,
        });
      }
    }
  }

  // --- 2. Misma clave, otra cifra, en bloques distintos -----------------------
  const porClave = new Map<string, (typeof afirmado)[number][]>();
  for (const a of afirmado) if (a.h.valor != null) porClave.set(a.h.clave, [...(porClave.get(a.h.clave) ?? []), a]);
  for (const [clave, as] of porClave) {
    const bloquesDistintos = new Set(as.map((a) => a.bloque));
    if (bloquesDistintos.size < 2) continue;
    const valores = new Set(as.map((a) => Number(a.h.valor)));
    if (valores.size < 2) continue;
    // Si ya las decidió el libro (mismo grupo, compatible o secuencia), no es discrepancia.
    const grupos = new Set(as.map((a) => a.h.grupo_conflicto));
    if (grupos.size === 1 && as[0].h.grupo_conflicto && as.every((a) => a.h.veredicto && a.h.veredicto !== "excluyente")) continue;
    const [primero, ...resto] = [...as].sort((x, y) => x.bloque - y.bloque);
    for (const a of resto.filter((x) => x.bloque !== primero.bloque && Number(x.h.valor) !== Number(primero.h.valor))) {
      const enOracion = numerosDe(a.oracion);
      out.push({
        bloque: a.bloque,
        tipo: "otro_valor",
        otroBloque: primero.bloque,
        cita: a.oracion.slice(0, 200),
        detalle: `«${clave}»: ${a.h.valor} aquí, ${primero.h.valor} en el bloque ${primero.bloque}${enOracion.length ? "" : " (la cifra no aparece en la oración)"}.`,
        correccion: `Afirmas ${a.h.valor}${a.h.unidad ? ` ${a.h.unidad}` : ""} para «${a.h.enunciado.slice(0, 120)}», y el bloque ${primero.bloque} afirma ${primero.h.valor}${primero.h.unidad ? ` ${primero.h.unidad}` : ""} para el mismo dato. Remite a esa sección en lugar de dar la cifra, o márcalo pendiente si tu fuente la contradice.`,
      });
    }
  }

  // --- 6. Cambios de proceso negados a nivel documento (Paso 5c, caso 1) -------
  // «Sin cambios» en un bloque frente a hechos de CUALQUIER bloque con verbo de
  // cambio y fecha del ejercicio.
  const reporteId = (bloques[0]?.documento as unknown as { reporte_id: string } | null)?.reporte_id;
  const { data: rep } = reporteId ? await db.from("reportes").select("ejercicio").eq("id", reporteId).maybeSingle() : { data: null };
  if (rep?.ejercicio) {
    const cambios = (hs ?? []).filter((h) => h.estado === "vigente" && esCambioDelEjercicio({ enunciado: h.enunciado, extracto: h.extracto, periodo: h.periodo }, rep.ejercicio));
    // El bloque que responde «¿cambiaron los procesos?» (25(a)(vi)) no puede
    // omitir un cambio del ejercicio que otro bloque publica: «el cambio fue X»
    // niega los demás sin decirlo (caso 1 de la tercera revisión).
    for (const b of bloques.filter((x) => BLOQUES.find((y) => y.numero === x.numero)?.datapoints.some((c) => /\(a\)\(vi\)/.test(c)))) {
      const texto = palabras((b.texto ?? "").replace(/\[Pendiente:[^\]]*\]/g, " "));
      // Mencionado: el texto comparte al menos el 60 % de las palabras del hecho.
      const omitidos = cambios.filter((h) => {
        const w = palabras(h.enunciado);
        return h.bloque_dueno !== b.numero && [...w].filter((x) => texto.has(x)).length < Math.ceil(w.size * 0.6);
      });
      if (!omitidos.length) continue;
      const lista = omitidos.slice(0, 6).map((h) => `${h.enunciado.slice(0, 110)} (bloque ${h.bloque_dueno})`);
      out.push({
        bloque: b.numero,
        tipo: "cambios_negados",
        otroBloque: omitidos[0].bloque_dueno,
        cita: "Cambios en los procesos respecto del periodo anterior",
        detalle: `Responde si los procesos cambiaron, pero omite ${omitidos.length} cambio(s) del ejercicio que otros bloques publican: ${lista.join("; ")}.`,
        correccion: `Al responder si cambiaron los procesos, incluye estos cambios de ${rep.ejercicio} o remite a donde se describen: ${lista.join("; ")}.`,
      });
    }
    for (const b of bloques) {
      const m = (b.texto ?? "").replace(/\[Pendiente:[^\]]*\]/g, " ").match(SIN_CAMBIOS);
      if (!m) continue;
      const ajenos = cambios.filter((h) => h.bloque_dueno !== b.numero);
      if (!ajenos.length) continue;
      const lista = ajenos.slice(0, 6).map((h) => `${h.enunciado.slice(0, 110)} (bloque ${h.bloque_dueno})`);
      const i = (b.texto ?? "").indexOf(m[0]);
      out.push({
        bloque: b.numero,
        tipo: "cambios_negados",
        otroBloque: ajenos[0].bloque_dueno,
        cita: (b.texto ?? "").slice(Math.max(0, i - 80), i + m[0].length + 40),
        detalle: `Dice «${m[0]}», pero el libro tiene ${ajenos.length} cambio(s) del ejercicio en otros bloques: ${lista.join("; ")}.`,
        correccion: `El texto niega cambios de proceso en el ejercicio, pero estos hechos describen cambios de ${rep.ejercicio}: ${lista.join("; ")}. Revela los cambios o remite a donde se describen.`,
      });
    }
  }

  // --- 5. Remisiones: solo al dueño del hecho, y si lo afirma -----------------
  const tenantId = (bloques[0]?.documento as unknown as { tenant_id: string } | null)?.tenant_id;
  const { data: perfil } = tenantId
    ? await db.from("perfil_emisor").select("denominacion_formal, forma_de_referencia, glosario").eq("tenant_id", tenantId).maybeSingle()
    : { data: null };
  const nombres = [
    perfil?.denominacion_formal ?? "",
    perfil?.forma_de_referencia ?? "",
    ...leerGlosario(perfil?.glosario).flatMap((e) => [e.canonico, ...e.variantes]),
  ].filter(Boolean);
  const anclados = new Map(bloques.map((b) => [b.numero, new Set(anclas(b).flatMap((a) => a.hechos.map((x) => x.hecho).filter((x): x is string => !!x)))]));
  const remisiones = remisionesSinDueno(
    bloques.filter((b) => b.estado === "borrador").map((b) => ({ numero: b.numero, texto: b.texto ?? "" })),
    BLOQUES,
    new Set(bloques.filter((b) => b.estado === "borrador").map((b) => b.numero)),
    (hs ?? []).filter((h) => h.estado !== "descartado").map((h) => ({ id: h.id, dueno: h.bloque_dueno, enunciado: h.enunciado, narrativo: h.rango_fuente === "narrativo" })),
    anclados,
    nombres
  );
  for (const r of remisiones) {
    const destino = `al bloque ${r.destino} («${tituloDe(r.destino)}»)`;
    const que = r.contenido.replace(/^(?:y\s+)?/, "");
    const correccion =
      r.motivo === "destino_ausente"
        ? `Remites «${que}» ${destino}, que no está en este documento. Redáctalo aquí con tus hechos o márcalo pendiente.`
        : r.motivo === "remite_a_pendiente"
          ? `Remites «${que}» ${destino}, que lo deja pendiente. No remitas a un pendiente: redáctalo aquí si tienes el hecho o márcalo pendiente.`
          : r.motivo === "destino_no_lo_afirma" || r.dueno == null
            ? `Remites «${que}» ${destino}, que no lo desarrolla en su texto. Redáctalo aquí si tienes el hecho o márcalo pendiente.`
            : r.dueno === r.bloque
              ? `Remites «${que}» ${destino}, pero el hecho es de este bloque: redáctalo aquí.`
              : `Remites «${que}» ${destino}, pero el dueño de ese hecho es el bloque ${r.dueno} («${tituloDe(r.dueno!)}»). Remite a ese bloque o redáctalo aquí si tienes el hecho.`;
    out.push({
      bloque: r.bloque,
      tipo: "remision_sin_dueno",
      otroBloque: r.destino,
      cita: r.clausula.slice(0, 200),
      detalle: `Remite a ${r.destino} (${r.motivo.replace(/_/g, " ")}${r.dueno != null ? `; dueño ${r.dueno}` : ""}): «${que.slice(0, 140)}».`,
      correccion,
    });
  }
  return out;
}

/**
 * Correcciones por bloque: lo que va en `opciones.correccion` de cada reintento.
 * «afirma_excluyente» no dispara reintento: un hecho largo en contradicción se
 * puede citar por su parte no disputada (corrida completa del 5b: 15, 16 y 21
 * se reintentaron por eso, $1.79). Queda como observación para el revisor.
 */
export function correccionesPorBloque(ds: Discrepancia[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const d of ds.filter((x) => x.tipo !== "afirma_excluyente")) out.set(d.bloque, [out.get(d.bloque), `- ${d.correccion}`].filter(Boolean).join("\n"));
  return out;
}
