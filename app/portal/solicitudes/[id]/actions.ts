"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";

const BUCKET = "evidencias";

export type SubirState = {
  ok: boolean;
  version?: number;
  error?: string | null;
};

function nombreSeguro(nombre: string): string {
  const base = nombre.normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim();
  return base.replace(/\s+/g, "_").slice(0, 120) || "archivo";
}

export async function subirEvidencia(
  _prev: SubirState,
  formData: FormData
): Promise<SubirState> {
  const perfil = await getPerfilActual();
  if (!perfil) return { ok: false, error: "Sesión no válida." };

  const solicitudId = String(formData.get("solicitud_id") ?? "");
  const periodoCubierto = String(formData.get("periodo_cubierto") ?? "").trim();
  const areaOrigen = String(formData.get("area_origen") ?? "").trim();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecciona o arrastra un archivo." };
  }
  if (!periodoCubierto) {
    return { ok: false, error: "Indica el periodo cubierto por la evidencia." };
  }

  const supabase = await createClient();

  // La solicitud (RLS valida acceso) — estado, tipo y reporte.
  const { data: sol, error: solErr } = await supabase
    .from("solicitudes")
    .select("id, estado, es_cuantitativa, reporte_id")
    .eq("id", solicitudId)
    .single();

  if (solErr || !sol) {
    return { ok: false, error: "No se encontró la solicitud o no tienes acceso." };
  }
  if (sol.estado === "congelado") {
    return {
      ok: false,
      error: "La solicitud está congelada; la carga está deshabilitada.",
    };
  }

  // Tenant a partir del reporte (para construir la ruta de storage).
  const { data: rep } = await supabase
    .from("reportes")
    .select("tenant_id")
    .eq("id", sol.reporte_id)
    .single();

  const tenantId = rep?.tenant_id;
  if (!tenantId) {
    return { ok: false, error: "La solicitud no tiene un tenant asociado." };
  }

  // Ruta conforme a la política de storage: {tenant_id}/{solicitud_id}/<archivo>
  const path = `${tenantId}/${solicitudId}/${Date.now()}-${nombreSeguro(file.name)}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (upErr) {
    return { ok: false, error: `No se pudo subir el archivo: ${upErr.message}` };
  }

  // Inserta la evidencia (el trigger asigna version y avanza el estado).
  const { data: ev, error: evErr } = await supabase
    .from("evidencias")
    .insert({
      solicitud_id: solicitudId,
      archivo_path: path,
      nombre_original: file.name,
      periodo_cubierto: periodoCubierto,
      area_origen: areaOrigen || null,
      subido_por: perfil.id,
      // `version` la asigna el trigger; enviamos un placeholder que será sobreescrito.
      version: 0,
    })
    .select("id, version")
    .single();

  if (evErr || !ev) {
    return {
      ok: false,
      error: `El archivo se subió pero no se registró la evidencia: ${evErr?.message ?? ""}`,
    };
  }

  // Captura de valor (solo si la solicitud es cuantitativa y se proporcionó valor).
  if (sol.es_cuantitativa) {
    const valorRaw = String(formData.get("valor") ?? "").trim();
    if (valorRaw !== "") {
      const valor = Number(valorRaw.replace(/,/g, ""));
      const unidad = String(formData.get("unidad") ?? "").trim();
      const periodoCaptura = String(formData.get("periodo_captura") ?? "").trim();
      if (Number.isFinite(valor) && unidad) {
        const { error: capErr } = await supabase.from("capturas_valor").insert({
          solicitud_id: solicitudId,
          evidencia_id: ev.id,
          valor,
          unidad,
          periodo: periodoCaptura || null,
          capturado_por: perfil.id,
          confirmado: true,
        });
        if (capErr) {
          return {
            ok: true,
            version: ev.version,
            error: `Evidencia v${ev.version} registrada, pero la captura de valor falló: ${capErr.message}`,
          };
        }
      }
    }
  }

  revalidatePath(`/portal/solicitudes/${solicitudId}`);
  revalidatePath("/portal");
  return { ok: true, version: ev.version, error: null };
}

export type ComentarioState = { ok: boolean; error?: string | null };

export async function agregarComentario(
  _prev: ComentarioState,
  formData: FormData
): Promise<ComentarioState> {
  const perfil = await getPerfilActual();
  if (!perfil) return { ok: false, error: "Sesión no válida." };

  const solicitudId = String(formData.get("solicitud_id") ?? "");
  const contenido = String(formData.get("contenido") ?? "").trim();

  if (!contenido) return { ok: false, error: "Escribe un comentario." };

  const supabase = await createClient();
  const { error } = await supabase.from("comentarios").insert({
    solicitud_id: solicitudId,
    autor_id: perfil.id,
    contenido,
    es_observacion: false,
  });

  if (error) {
    return { ok: false, error: "No se pudo publicar el comentario." };
  }

  revalidatePath(`/portal/solicitudes/${solicitudId}`);
  return { ok: true, error: null };
}
