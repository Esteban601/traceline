import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import type { Contenido } from "./extraer";
import { MODELO_SUGERENCIA, PROMPT_SUGERENCIA_VERSION, sugerirNumerica } from "./sugerir";
import { lecturasDelMes, mensajeTope } from "./tope";
import { PROMPT_TEXTO_VERSION, sugerirTexto } from "./sugerir-texto";

// =============================================================================
// SUGERENCIAS EN BASE DE DATOS — captura sugerida, Paso 2.
//
// `generarSugerencia(contenidoId)` corre al terminar la lectura de una
// evidencia (cola.ts) y desde /api/evidencias/sugerir (para regenerar sin
// volver a leer el archivo). Guarda una fila en `sugerencias_captura`:
//   · `sugerida` si quedó al menos una cifra con fuente verificada;
//   · `fallida` si no, con el motivo y el costo (no se muestra; encargo §3).
// Antes de insertar deja `obsoleta` la sugerida anterior de la solicitud.
//
// Solo se sugiere sobre la evidencia MÁS RECIENTE de la solicitud: si el cron
// procesa tarde una versión vieja, no genera nada. Numérica o de texto según
// `solicitudes.es_cuantitativa`.
// =============================================================================

export type ResultadoGeneracion = { contenidoId: string; estado: string; detalle?: string; sugerenciaId?: string };

/** Deja `obsoleta` lo sugerido sobre versiones anteriores de la evidencia. */
export async function obsoletarAnteriores(solicitudId: string, version: number): Promise<number> {
  const { data } = await createAdminClient()
    .from("sugerencias_captura")
    .update({ estado: "obsoleta" })
    .eq("solicitud_id", solicitudId)
    .eq("estado", "sugerida")
    .lt("evidencia_version", version)
    .select("id");
  return data?.length ?? 0;
}

/**
 * `regenerada`: la pide /api/evidencias/sugerir. Cuenta como una lectura contra
 * `lecturas_mes_max` y se rechaza si el tope ya se alcanzó. Desde la cola no
 * cuenta aparte: va incluida en la lectura.
 */
export async function generarSugerencia(
  contenidoId: string,
  { regenerada = false }: { regenerada?: boolean } = {}
): Promise<ResultadoGeneracion> {
  const db = createAdminClient();
  const fin = (estado: string, detalle?: string, sugerenciaId?: string) => ({ contenidoId, estado, detalle, sugerenciaId });

  const { data: fila } = await db
    .from("evidencias_contenido")
    .select("id, solicitud_id, tenant_id, evidencia_id, version, estado, contenido, nombre_original")
    .eq("id", contenidoId)
    .maybeSingle();
  if (!fila) return fin("inexistente");
  if (fila.estado !== "extraido" || !fila.contenido) return fin("sin_contenido", `lectura en «${fila.estado}»`);

  const { data: ultima } = await db
    .from("evidencias_contenido")
    .select("version")
    .eq("solicitud_id", fila.solicitud_id)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (ultima && ultima.version > fila.version) return fin("version_vieja", `hay una versión ${ultima.version}`);

  const { data: sol } = await db
    .from("solicitudes")
    .select("titulo, descripcion, unidad_esperada, es_cuantitativa, reporte_id")
    .eq("id", fila.solicitud_id)
    .single();
  if (!sol) return fin("sin_solicitud");

  const { data: tenant } = await db
    .from("tenants")
    .select("lectura_evidencias_activa, lecturas_mes_max")
    .eq("id", fila.tenant_id)
    .single();
  if (!tenant?.lectura_evidencias_activa) return fin("omitido", "la lectura de evidencias está apagada para esta emisora");
  if (regenerada && (await lecturasDelMes(db, fila.tenant_id)) >= tenant.lecturas_mes_max) {
    return fin("tope", mensajeTope(tenant.lecturas_mes_max));
  }

  const [{ data: reporte }, { data: mapeo }] = await Promise.all([
    db.from("reportes").select("ejercicio").eq("id", sol.reporte_id).single(),
    db.from("mapeo_solicitud_datapoint").select("datapoints_taxonomia(codigo, descripcion)").eq("solicitud_id", fila.solicitud_id),
  ]);
  const codigos = (mapeo ?? [])
    .map((m) => m.datapoints_taxonomia as unknown as { codigo: string; descripcion: string } | null)
    .filter((d): d is { codigo: string; descripcion: string } => Boolean(d))
    .map((d) => `${d.codigo} — ${d.descripcion}`);

  const paraSugerir = {
    titulo: sol.titulo,
    descripcion: sol.descripcion,
    unidad_esperada: sol.unidad_esperada,
    codigos,
    ejercicio: reporte?.ejercicio ?? new Date().getFullYear(),
  };
  const contenido = fila.contenido as unknown as Contenido;
  const base = {
    solicitud_id: fila.solicitud_id,
    tenant_id: fila.tenant_id,
    evidencia_id: fila.evidencia_id,
    contenido_id: fila.id,
    evidencia_version: fila.version,
    regenerada,
  };
  const totales = (llamadas: { tokensEntrada: number; tokensSalida: number; costoUsd: number; modelo: string }[]) => ({
    modelo: llamadas.map((l) => l.modelo).join(" + ") || MODELO_SUGERENCIA,
    tokens_entrada: llamadas.reduce((s, l) => s + l.tokensEntrada, 0),
    tokens_salida: llamadas.reduce((s, l) => s + l.tokensSalida, 0),
    costo_usd: Number(llamadas.reduce((s, l) => s + l.costoUsd, 0).toFixed(4)),
  });
  const obsoletarViva = () =>
    db.from("sugerencias_captura").update({ estado: "obsoleta" }).eq("solicitud_id", fila.solicitud_id).eq("estado", "sugerida");

  // Narrativa (Paso 3): extracto con fragmentos verificados y línea de cobertura.
  if (!sol.es_cuantitativa) {
    const t = await sugerirTexto(paraSugerir, contenido, fila.nombre_original);
    await obsoletarViva();
    const { data: nueva, error } = await db
      .from("sugerencias_captura")
      .insert({
        ...base,
        tipo: "texto",
        estado: t.estado,
        extracto: t.extracto,
        cobertura: t.cobertura,
        fuente: { cubre_requisito: t.cubreRequisito, fragmentos: t.fragmentos } as unknown as Json,
        confianza: t.confianza,
        motivo: t.motivo || null,
        segunda_opinion: (t.descartadas.length ? { descartadas: t.descartadas } : null) as Json,
        prompt_version: PROMPT_TEXTO_VERSION,
        error: t.error,
        ...totales(t.llamadas),
      })
      .select("id")
      .single();
    if (error) return fin("error", `no se guardó la sugerencia: ${error.message}`);
    return fin(t.estado, t.error ?? undefined, nueva.id);
  }

  const r = await sugerirNumerica(paraSugerir, contenido, fila.nombre_original);
  await obsoletarViva();

  const p = r.principal;
  const { data: nueva, error } = await db
    .from("sugerencias_captura")
    .insert({
      ...base,
      tipo: "numerica",
      estado: r.estado,
      valor: p?.valor ?? null,
      unidad: p?.unidad ?? null,
      periodo: p?.periodo ?? null,
      fuente: (p?.fuente ?? null) as Json,
      cita: p?.cita ?? null,
      conversion: (p?.conversion ?? null) as Json,
      candidatos: r.candidatos as unknown as Json,
      confianza: r.confianza,
      motivo: [r.motivo, p?.nota].filter(Boolean).join(" · ") || null,
      segunda_opinion: (r.segundaOpinion
        ? { ...r.segundaOpinion, descartadas: r.descartadas }
        : r.descartadas.length
          ? { descartadas: r.descartadas }
          : null) as Json,
      prompt_version: PROMPT_SUGERENCIA_VERSION,
      error: r.error,
      ...totales(r.llamadas),
    })
    .select("id")
    .single();
  if (error) return fin("error", `no se guardó la sugerencia: ${error.message}`);
  return fin(r.estado, r.error ?? undefined, nueva.id);
}
