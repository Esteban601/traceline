import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES } from "@/lib/suplemento/bloques";
import { fronteraDe } from "@/lib/suplemento/fronteras";
import type { Uso } from "@/lib/suplemento/modelos";
import { recolectar } from "./fuentes";
import { clasificar, esObligatoria, lotes, MODELO_LIBRO, PROMPT_LIBRO_VERSION, type BloqueCatalogo, type FuenteEnOraciones } from "./extraer";
import { PLANTILLAS } from "@/lib/suplemento/plantillas";
import { ORGANOS, palabrasDe } from "./remisiones";
import { sinRepetidos, verificarClasificado } from "./verificar";
import { decidirContradicciones } from "./conflictos";
import { dividir } from "./oraciones";
import { organigramaEnHechos } from "./organigrama";
import { ORDEN_RANGO, type HechoNuevo, type UnidadTexto } from "./tipos";

// =============================================================================
// LIBRO DE HECHOS — la corrida (encargo suplemento-calidad, Paso 5).
//
//   reclamarLibro: abre un libro `generando` (uno en curso por reporte).
//   construirLibro: recolecta las fuentes, las parte en oraciones (código),
//     clasifica las oraciones (Sonnet 5.5, en serie), verifica cada hecho,
//     aplica el filtro de alcance E5 por hecho, lee el organigrama como árbol,
//     decide las contradicciones una sola vez y guarda el libro con su costo y
//     su resumen (Paso 5b).
//
// Si la huella de los insumos es la de un libro ya listo, se reutiliza: el libro
// es por reporte y no se paga dos veces por lo mismo.
// =============================================================================

type Db = SupabaseClient<Database>;
const ABANDONADO_MS = 15 * 60 * 1000;

/** Huella de los insumos de un libro: si no cambia, el libro sigue valiendo. */
export function huellaDe(material: unknown): string {
  return createHash("sha256").update(JSON.stringify([PROMPT_LIBRO_VERSION, material])).digest("hex");
}

export type ReclamoLibro = { ok: true; id: string } | { ok: false; status: number; error: string };

export async function reclamarLibro(db: Db, reporteId: string, perfilId: string): Promise<ReclamoLibro> {
  const { data: rep } = await db.from("reportes").select("id, tenant_id").eq("id", reporteId).maybeSingle();
  if (!rep) return { ok: false, status: 404, error: "El reporte no existe o no es visible." };
  await db
    .from("libros_hechos")
    .update({ estado: "error", error: "La corrida se interrumpió.", terminado_en: new Date().toISOString() })
    .eq("reporte_id", reporteId)
    .eq("estado", "generando")
    .lt("created_at", new Date(Date.now() - ABANDONADO_MS).toISOString());
  const { data, error } = await db
    .from("libros_hechos")
    .insert({ tenant_id: rep.tenant_id, reporte_id: reporteId, creado_por: perfilId, modelo: MODELO_LIBRO, prompt_version: PROMPT_LIBRO_VERSION })
    .select("id")
    .single();
  if (error || !data) {
    return error?.code === "23505"
      ? { ok: false, status: 409, error: "Ya se está armando el libro de hechos de este reporte." }
      : { ok: false, status: 500, error: `No se pudo abrir el libro: ${error?.message ?? "sin fila"}` };
  }
  return { ok: true, id: data.id };
}

const sumar = (a: Uso, b: Uso): Uso => ({
  entrada: a.entrada + b.entrada,
  cacheEscritura: a.cacheEscritura + b.cacheEscritura,
  cacheLectura: a.cacheLectura + b.cacheLectura,
  salida: a.salida + b.salida,
});

async function catalogoDeBloques(db: Db): Promise<BloqueCatalogo[]> {
  const codigos = [...new Set(BLOQUES.flatMap((b) => b.datapoints))];
  const { data } = await db.from("datapoints_taxonomia").select("codigo, descripcion").in("codigo", codigos);
  const desc = new Map((data ?? []).map((d) => [d.codigo, d.descripcion]));
  return BLOQUES.map((b) => ({
    numero: b.numero,
    titulo: b.titulo,
    clase: b.clase,
    cubre: fronteraDe(b.numero).cubre,
    plantilla: b.numero in PLANTILLAS,
    requisitos: b.datapoints.filter((c) => desc.has(c)).map((c) => ({ codigo: c, descripcion: desc.get(c)! })),
  }));
}

function resumir(hechos: HechoNuevo[], extra: Record<string, unknown>) {
  const cuenta = <K extends string>(f: (h: HechoNuevo) => K) => hechos.reduce<Record<string, number>>((a, h) => ((a[f(h)] = (a[f(h)] ?? 0) + 1), a), {});
  const porRango: Record<string, { total: number; verificados: number; descartados: number; en_conflicto: number }> = {};
  for (const h of hechos) {
    const r = (porRango[h.rango_fuente] ??= { total: 0, verificados: 0, descartados: 0, en_conflicto: 0 });
    r.total++;
    if (h.verificado) r.verificados++;
    if (h.estado === "descartado") r.descartados++;
    if (h.estado === "en_conflicto") r.en_conflicto++;
  }
  const vivos = hechos.filter((h) => h.estado !== "descartado");
  return {
    total: hechos.length,
    vigentes: hechos.filter((h) => h.estado === "vigente").length,
    en_conflicto: hechos.filter((h) => h.estado === "en_conflicto").length,
    descartados: hechos.filter((h) => h.estado === "descartado").length,
    grupos_en_conflicto: new Set(hechos.filter((h) => h.estado === "en_conflicto").map((h) => h.grupo_conflicto).filter(Boolean)).size,
    grupos_conciliados: new Set(hechos.filter((h) => h.veredicto && h.veredicto !== "excluyente").map((h) => h.grupo_conflicto).filter(Boolean)).size,
    por_rango: porRango,
    por_fuente: cuenta((h) => h.fuente_tipo),
    motivos_descarte: cuenta((h) => (h.estado === "descartado" ? h.verificacion.replace(/«[^»]*»/g, "«…»") : "—")),
    por_bloque_dueno: vivos.reduce<Record<string, number>>((a, h) => ((a[String(h.bloque_dueno)] = (a[String(h.bloque_dueno)] ?? 0) + 1), a), {}),
    bloques_sin_hechos: BLOQUES.filter((b) => !vivos.some((h) => h.bloque_dueno === b.numero)).map((b) => b.numero),
    ...extra,
  };
}

export async function construirLibro(db: Db, libroId: string, reporteId: string, opciones: { forzar?: boolean } = {}): Promise<void> {
  const inicio = Date.now();
  const fin = (cambios: Record<string, unknown>) =>
    db.from("libros_hechos").update({ ...cambios, duracion_ms: Date.now() - inicio, terminado_en: new Date().toISOString() }).eq("id", libroId);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await fin({ estado: "error", error: "Falta ANTHROPIC_API_KEY." });
    return;
  }
  try {
    const { data: libro } = await db.from("libros_hechos").select("tenant_id").eq("id", libroId).single();
    const tenantId = libro!.tenant_id;
    const rec = await recolectar(db, reporteId, tenantId);
    const huella = huellaDe(rec.material);

    // Misma huella que un libro listo: se reutiliza, no se paga otra vez.
    if (!opciones.forzar) {
      const { data: previo } = await db
        .from("libros_hechos")
        .select("id")
        .eq("reporte_id", reporteId)
        .eq("estado", "listo")
        .eq("huella", huella)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previo) {
        await fin({ estado: "reutilizado", huella, reutiliza_libro: previo.id, error: null });
        return;
      }
    }

    // --- Oraciones (código) y clasificación (modelo), en serie ----------------
    const bloques = await catalogoDeBloques(db);
    // Validado primero: sus claves son las que conviene reutilizar después.
    const ordenadas = [...rec.textos].sort((a, b) => ORDEN_RANGO[a.rango] - ORDEN_RANGO[b.rango]);
    const enOraciones: FuenteEnOraciones[] = ordenadas
      .map((u) => ({ unidad: u, oraciones: dividir(u.id, u.texto, { pdf: u.pdf }) }))
      .filter((f) => f.oraciones.length);
    const oraciones = new Map<string, { texto: string; unidad: UnidadTexto }>();
    for (const f of enOraciones) for (const o of f.oraciones) oraciones.set(o.id, { texto: o.texto, unidad: f.unidad });
    const porLotes = lotes(enOraciones);
    let uso: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
    let costo = 0;
    let llamadas = 0;
    const errores: string[] = [];
    const clasificados: HechoNuevo[] = [];
    let duenosPorTaxonomia = 0;
    const desacuerdos: { modelo: number | null; codigo: number; oracion: string }[] = [];
    const sinOrganos = (w: Set<string>) => new Set([...w].filter((x) => !ORGANOS.includes(x)));
    const vocabulario = new Map(bloques.map((b) => [b.numero, sinOrganos(palabrasDe([b.titulo, b.cubre, ...b.requisitos.map((r) => r.descripcion)].join(" ")))]));
    const claves = new Set<string>(rec.directos.map((d) => d.clave));
    for (const lote of porLotes) {
      const r = await clasificar(lote, bloques, [...claves], apiKey);
      llamadas++;
      uso = sumar(uso, r.uso);
      costo += r.costo;
      if (r.error) errores.push(`${lote.map((f) => f.unidad.id).join(", ").slice(0, 120)}: ${r.error}`);
      for (const p of r.hechos) {
        const h = verificarClasificado(p, oraciones);
        // DUEÑO POR TAXONOMÍA PRIMERO (estabilidad del dueño): si la fuente
        // responde datapoints de UN solo bloque, ese bloque es el dueño; lo que
        // el modelo eligió pasa a referencia. El modelo decide solo cuando la
        // fuente sirve a varios bloques (adjuntos, campos del Perfil compartidos).
        const sugeridos = (oraciones.get(p.oracion)?.unidad.sugeridos ?? []).filter((n) => !(n in PLANTILLAS));
        // Segunda capa, también por código: entre varios bloques sugeridos, el
        // que comparte claramente más palabras con sus requisitos del catálogo.
        let porRequisitos: number | null = null;
        if (h.estado === "vigente" && sugeridos.length > 1) {
          const w = sinOrganos(palabrasDe(oraciones.get(p.oracion)!.texto));
          const puntos = sugeridos.map((n) => ({ n, pts: [...w].filter((x) => vocabulario.get(n)?.has(x)).length })).sort((a, b) => b.pts - a.pts || a.n - b.n);
          if (puntos[0].pts >= 3 && puntos[0].pts >= 1.5 * puntos[1].pts) porRequisitos = puntos[0].n;
        }
        const unico = sugeridos.length === 1 ? sugeridos : porRequisitos != null ? [porRequisitos] : [];
        if (h.estado === "vigente" && unico.length === 1) {
          if (porRequisitos != null && h.bloque_dueno !== porRequisitos && desacuerdos.length < 40) desacuerdos.push({ modelo: h.bloque_dueno, codigo: porRequisitos, oracion: h.enunciado.slice(0, 120) });
          if (h.bloque_dueno !== unico[0]) {
            h.bloques_referencia = [...new Set([h.bloque_dueno, ...h.bloques_referencia].filter((n): n is number => n != null && n !== unico[0]))].slice(0, 3);
            h.bloque_dueno = unico[0];
          }
          h.verificacion = `${h.verificacion}; dueño por ${porRequisitos != null ? "requisitos del catálogo" : "taxonomía"}`;
          duenosPorTaxonomia++;
        }
        clasificados.push(h);
        if (h.estado === "vigente") claves.add(h.clave);
      }
    }

    // Una entrada por oración: si el modelo repitió una, vale la primera.
    const vistas = new Set<string>();
    const unicos = clasificados.filter((h) => {
      if (!h.oracion || h.estado !== "vigente") return true;
      if (vistas.has(h.oracion)) return false;
      vistas.add(h.oracion);
      return true;
    });

    // Los bloques de plantilla no son dueños de hechos (Paso 5b, punto 12): el
    // hecho pasa al primer bloque que lo refiere y no es plantilla.
    const esPlantilla = (n: number | null) => n != null && n in PLANTILLAS;
    for (const h of unicos) {
      if (h.estado !== "vigente" || !esPlantilla(h.bloque_dueno)) continue;
      const otro = h.bloques_referencia.find((n) => !esPlantilla(n));
      if (otro != null) Object.assign(h, { bloque_dueno: otro, bloques_referencia: h.bloques_referencia.filter((n) => n !== otro) });
      else Object.assign(h, { estado: "descartado", verificacion: "descartado: su único bloque es de plantilla" });
    }

    // ESTABILIDAD (punto 10): en una fuente OBLIGATORIA ninguna oración se queda
    // fuera por decisión del modelo. La que no clasificó entra tal cual, con el
    // primer bloque sugerido de su fuente que no sea plantilla.
    const omitidas: HechoNuevo[] = [];
    for (const f of enOraciones.filter((x) => esObligatoria(x.unidad))) {
      const dueno = f.unidad.sugeridos.find((n) => !esPlantilla(n)) ?? null;
      for (const o of f.oraciones) {
        if (vistas.has(o.id)) continue;
        omitidas.push({
          clave: `${f.unidad.id.replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 60)}.o${o.id.split("#")[1]}`,
          enunciado: o.texto,
          tipo: "otro",
          valor: null,
          unidad: null,
          periodo: null,
          rango_fuente: f.unidad.rango,
          fuente_tipo: f.unidad.fuenteTipo,
          fuente_id: f.unidad.id,
          fuente_detalle: f.unidad.detalle,
          extracto: o.texto,
          verificado: dueno != null,
          verificacion: dueno != null ? "oración de fuente obligatoria que el modelo no clasificó: entra tal cual" : "descartado: oración de fuente obligatoria sin bloque sugerido",
          bloque_dueno: dueno,
          bloques_referencia: [],
          estado: dueno != null ? "vigente" : "descartado",
          oracion: o.id,
          alcance: null,
        });
      }
    }
    unicos.push(...omitidas);

    // Filtro de alcance POR HECHO (segunda revisión, punto 4): un hecho
    // verificado no es un hecho pertinente. Lo genérico (estatutos,
    // formalidades) nunca entra; con E5 vigente, tampoco la sostenibilidad que
    // no es de clima. Lo propio de la entidad (perímetro, cifras de negocio,
    // composición del Consejo) sí entra: es contexto que el informe necesita.
    for (const h of unicos) {
      if (h.estado !== "vigente") continue;
      // Lo genérico solo se filtra en los adjuntos: una fuente obligatoria ya es respuesta a lo que el informe pregunta.
      if (h.alcance === "generico" && h.rango_fuente === "adjunto") Object.assign(h, { estado: "descartado", verificacion: "descartado: alcance genérico (cláusula que tendría cualquier emisora)" });
      else if (rec.e5Vigente && h.alcance === "sostenibilidad_general") Object.assign(h, { estado: "descartado", verificacion: "descartado: fuera del alcance E5 (sostenibilidad que no es de clima)" });
    }

    // Organigrama como árbol: nodo, padre, nivel (segunda revisión, punto 5).
    const org = await organigramaEnHechos(db, tenantId, apiKey);
    if (org.uso.entrada || org.uso.salida) llamadas++;
    uso = sumar(uso, org.uso);
    costo += org.costo;
    if (org.error) errores.push(org.error);

    const hechos = sinRepetidos([...rec.directos, ...org.hechos, ...unicos]);
    const conf = await decidirContradicciones(hechos, apiKey);
    if (conf.uso.entrada || conf.uso.salida) llamadas++;
    uso = sumar(uso, conf.uso);
    costo += conf.costo;
    if (conf.error) errores.push(`contradicciones: ${conf.error}`);

    // --- Guardado ------------------------------------------------------------
    const filas = hechos.map((h) => ({ ...h, libro_id: libroId, tenant_id: tenantId }));
    for (let i = 0; i < filas.length; i += 200) {
      const { error } = await db.from("hechos").insert(filas.slice(i, i + 200));
      if (error) throw new Error(`no se guardaron los hechos: ${error.message}`);
    }
    await fin({
      estado: "listo",
      huella,
      llamadas,
      tokens_entrada: uso.entrada,
      tokens_entrada_cache_escritura: uso.cacheEscritura,
      tokens_entrada_cache_lectura: uso.cacheLectura,
      tokens_salida: uso.salida,
      costo_usd: costo,
      error: errores.length ? errores.join(" | ").slice(0, 1000) : null,
      resumen: resumir(hechos, {
        fuentes_de_texto: rec.textos.length,
        oraciones: oraciones.size,
        lotes: porLotes.length,
        e5_vigente: rec.e5Vigente,
        por_alcance: hechos.reduce<Record<string, number>>((a, h) => ((a[h.alcance ?? "—"] = (a[h.alcance ?? "—"] ?? 0) + 1), a), {}),
        nodos_organigrama: org.hechos.filter((h) => h.estado === "vigente").length,
        oraciones_obligatorias_omitidas: omitidas.length,
        duenos_por_taxonomia: duenosPorTaxonomia,
        duenos_por_requisitos_contra_modelo: desacuerdos,
        contradicciones: { grupos: conf.grupos, excluyentes: conf.excluyentes, conciliados: conf.conciliados, por_conciliar: conf.porConciliar ?? 0, en_conflicto: conf.enConflicto },
        insumos: rec.insumos,
      }),
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[libro] ${libroId.slice(0, 8)}: ${error.slice(0, 300)}`);
    await fin({ estado: "error", error: error.slice(0, 1000) });
  }
}

/**
 * El libro que vale para un reporte: el último listo, siguiendo a una corrida
 * «reutilizado» hasta el libro que reutiliza. Null si no hay ninguno.
 */
export async function libroVigente(db: Db, reporteId: string): Promise<{ id: string; corridaId: string } | null> {
  const { data } = await db
    .from("libros_hechos")
    .select("id, estado, reutiliza_libro")
    .eq("reporte_id", reporteId)
    .in("estado", ["listo", "reutilizado"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.estado === "reutilizado" && data.reutiliza_libro ? data.reutiliza_libro : data.id, corridaId: data.id };
}
