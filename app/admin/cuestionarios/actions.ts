"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";
import { esHojaCuestionario, preguntasDe } from "@/lib/cuestionarios";

export type CuestionarioState = {
  ok: boolean;
  error?: string | null;
  mensaje?: string | null;
};

function texto(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

/** tenant del reporte, para la bitácora. */
async function tenantDeReporte(
  db: Awaited<ReturnType<typeof createClient>>,
  reporteId: string
): Promise<string | null> {
  const { data } = await db.from("reportes").select("tenant_id").eq("id", reporteId).single();
  return data?.tenant_id ?? null;
}

// -----------------------------------------------------------------------------
// Guardar una sección (hoja) completa — upsert por (reporte, hoja, orden).
//
// Las respuestas son ficha descriptiva editable (no evidencia): se sobrescriben.
// Cada guardado deja traza en bitácora. Los campos llegan como `r_<orden>`,
// `t_<orden>` (tipo de dato) y `n_<orden>` (notas). Solo se persisten las
// preguntas que traen ALGÚN dato; una respuesta que se vacía por completo se
// elimina (vuelve al estado "pendiente" en el export).
// -----------------------------------------------------------------------------
export async function guardarSeccion(
  _prev: CuestionarioState,
  fd: FormData
): Promise<CuestionarioState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const reporteId = texto(fd, "reporte_id");
  const hoja = texto(fd, "hoja");
  if (!reporteId) return { ok: false, error: "Selecciona el reporte." };
  if (!hoja || !esHojaCuestionario(hoja)) return { ok: false, error: "Hoja no válida." };

  const preguntas = preguntasDe(hoja);
  if (preguntas.length === 0) return { ok: false, error: "La hoja no tiene preguntas." };

  const db = await createClient();

  const aGuardar: {
    reporte_id: string;
    hoja: string;
    pregunta_orden: number;
    respuesta: string | null;
    tipo_dato: string | null;
    notas: string | null;
    updated_at: string;
  }[] = [];
  const aBorrar: number[] = [];
  const ahora = new Date().toISOString();

  for (const p of preguntas) {
    const respuesta = texto(fd, `r_${p.orden}`);
    const notas = texto(fd, `n_${p.orden}`);
    // 22(b): el tipo de dato es fijo de la estructura oficial (catálogo). 36(e):
    // se captura libre. El catálogo manda; el input libre solo aplica sin etiqueta.
    const tipoLibre = p.tipoDatoLabel ? null : texto(fd, `t_${p.orden}`);
    const tipoDato = p.tipoDatoLabel ?? tipoLibre;
    // "Tiene datos" según contenido del usuario (respuesta/notas/tipo libre), NO
    // según la etiqueta derivada del catálogo: una pregunta 22(b) sin responder no
    // debe persistir una fila solo por su tipo fijo.
    const tieneDatos = respuesta != null || notas != null || tipoLibre != null;
    if (!tieneDatos) {
      aBorrar.push(p.orden); // sin datos: no dejar fila vacía
    } else {
      aGuardar.push({
        reporte_id: reporteId,
        hoja,
        pregunta_orden: p.orden,
        respuesta,
        tipo_dato: tipoDato,
        notas,
        updated_at: ahora,
      });
    }
  }

  if (aGuardar.length > 0) {
    const { error } = await db
      .from("cuestionarios_respuestas")
      .upsert(aGuardar, { onConflict: "reporte_id,hoja,pregunta_orden" });
    if (error) return { ok: false, error: "No se pudieron guardar las respuestas." };
  }
  if (aBorrar.length > 0) {
    const { error } = await db
      .from("cuestionarios_respuestas")
      .delete()
      .eq("reporte_id", reporteId)
      .eq("hoja", hoja)
      .in("pregunta_orden", aBorrar);
    if (error) return { ok: false, error: "No se pudieron limpiar las respuestas vacías." };
  }

  // "respondidas" = preguntas con RESPUESTA real (no solo tipo/notas), consistente
  // con el badge de la UI y con la noción de "pendiente" del export.
  const respondidas = aGuardar.filter((x) => x.respuesta != null).length;

  await logEvento(db, {
    tenantId: await tenantDeReporte(db, reporteId),
    usuarioId: perfil.id,
    accion: "cuestionario_respondido",
    entidad: "cuestionarios_respuestas",
    entidadId: null,
    detalle: { hoja, respondidas, guardadas: aGuardar.length, total: preguntas.length },
  });

  revalidatePath("/admin/cuestionarios");
  return {
    ok: true,
    error: null,
    mensaje: `Sección guardada — ${respondidas} de ${preguntas.length} respondida${respondidas === 1 ? "" : "s"}.`,
  };
}
