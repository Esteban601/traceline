import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES } from "@/lib/suplemento/bloques";
import { fronteraDe } from "@/lib/suplemento/fronteras";
import type { Uso } from "@/lib/suplemento/modelos";
import { recolectar } from "./fuentes";
import { atomizar, lotes, MODELO_LIBRO, PROMPT_LIBRO_VERSION, type BloqueCatalogo } from "./extraer";
import { sinRepetidos, verificarPropuesto } from "./verificar";
import { detectarContradicciones } from "./conflictos";
import type { HechoNuevo, UnidadTexto } from "./tipos";

// =============================================================================
// LIBRO DE HECHOS — la corrida (encargo suplemento-calidad, Paso 5).
//
//   reclamarLibro: abre un libro `generando` (uno en curso por reporte).
//   construirLibro: recolecta las fuentes, atomiza los textos (Sonnet 5.5, en
//     serie), verifica cada hecho contra su fuente, marca contradicciones y
//     guarda el libro con su costo y su resumen.
//
// Si la huella de los insumos es la de un libro ya listo, se reutiliza: el libro
// es por reporte y no se paga dos veces por lo mismo.
// =============================================================================

type Db = SupabaseClient<Database>;
const ABANDONADO_MS = 15 * 60 * 1000;

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
    grupos_en_conflicto: new Set(hechos.map((h) => h.grupo_conflicto).filter(Boolean)).size,
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
    const huella = createHash("sha256").update(JSON.stringify([PROMPT_LIBRO_VERSION, rec.material])).digest("hex");

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
        await fin({ estado: "error", huella, error: `Sin cambios en los insumos: se usa el libro ${previo.id}.` });
        return;
      }
    }

    // --- Atomización, en serie (cada llamada recibe las claves ya usadas) ------
    const bloques = await catalogoDeBloques(db);
    const fuentes = new Map<string, UnidadTexto>(rec.textos.map((u) => [u.id, u]));
    // Validado primero: sus claves son las que conviene reutilizar después.
    const orden = { validado: 0, perfil: 1, adjunto: 2 } as const;
    const porLotes = lotes([...rec.textos].sort((a, b) => orden[a.rango] - orden[b.rango]));
    let uso: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
    let costo = 0;
    const errores: string[] = [];
    const propuestos: HechoNuevo[] = [];
    const claves = new Set<string>(rec.directos.map((d) => d.clave));
    for (const lote of porLotes) {
      const r = await atomizar(lote, bloques, [...claves], apiKey);
      uso = sumar(uso, r.uso);
      costo += r.costo;
      if (r.error) errores.push(`${lote.map((u) => u.id).join(", ").slice(0, 120)}: ${r.error}`);
      for (const p of r.hechos) {
        const h = verificarPropuesto(p, fuentes);
        propuestos.push(h);
        if (h.estado === "vigente") claves.add(h.clave);
      }
    }

    const hechos = sinRepetidos([...rec.directos, ...propuestos]);
    const conf = await detectarContradicciones(hechos, apiKey);
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
      llamadas: porLotes.length + (conf.uso.entrada || conf.uso.salida ? 1 : 0),
      tokens_entrada: uso.entrada,
      tokens_entrada_cache_escritura: uso.cacheEscritura,
      tokens_entrada_cache_lectura: uso.cacheLectura,
      tokens_salida: uso.salida,
      costo_usd: costo,
      error: errores.length ? errores.join(" | ").slice(0, 1000) : null,
      resumen: resumir(hechos, {
        fuentes_de_texto: rec.textos.length,
        lotes: porLotes.length,
        grupos_misma_clave: conf.grupos,
        insumos: rec.insumos,
      }),
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[libro] ${libroId.slice(0, 8)}: ${error.slice(0, 300)}`);
    await fin({ estado: "error", error: error.slice(0, 1000) });
  }
}
