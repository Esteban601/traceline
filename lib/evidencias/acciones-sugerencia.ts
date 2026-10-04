"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esAuditor } from "@/lib/data";

// =============================================================================
// DECIDIR UNA SUGERENCIA — captura sugerida, Paso 4.
//
// Toda la decisión ocurre en la base, en fn_decidir_sugerencia, en una sola
// transacción: estado, captura (origen sugerida) y bitácora. Esta acción solo
// la invoca con la sesión del usuario y traduce el resultado.
//
// El rechazo del auditor está en la función (explícito y primero, porque es
// SECURITY DEFINER y se salta la barrera). El de aquí existe para que el
// mensaje llegue como una frase y quede escrito que la exclusión es deliberada.
// =============================================================================

export type DecisionState = { ok: boolean; mensaje: string | null; error: string | null };

const MENSAJES: Record<string, string> = {
  confirmada: "Sugerencia confirmada; la cifra quedó capturada.",
  corregida: "Sugerencia corregida; la cifra quedó capturada con tu valor.",
  rechazada: "Sugerencia rechazada.",
  confirmada_texto: "Extracto confirmado.",
  corregida_texto: "Extracto corregido.",
};

function numero(crudo: FormDataEntryValue | null): number | null {
  const t = String(crudo ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  // Se acepta 1,234.5 y 1234.5 (el campo se precarga con punto decimal).
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export async function decidirSugerencia(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const perfil = await getPerfilActual();
  if (!perfil) return { ok: false, mensaje: null, error: "Sesión no válida." };
  if (esAuditor(perfil)) {
    return { ok: false, mensaje: null, error: "El auditor externo no puede decidir sugerencias." };
  }

  const sugerenciaId = String(formData.get("sugerencia_id") ?? "");
  const solicitudId = String(formData.get("solicitud_id") ?? "");
  const accion = String(formData.get("accion") ?? "");
  const tipo = String(formData.get("tipo") ?? "numerica");
  if (!sugerenciaId || !["confirmar", "corregir", "rechazar"].includes(accion)) {
    return { ok: false, mensaje: null, error: "Solicitud no válida." };
  }

  const valor = numero(formData.get("valor"));
  if (accion === "corregir" && tipo === "numerica" && (valor === null || Number.isNaN(valor))) {
    return { ok: false, mensaje: null, error: "Escribe un valor numérico." };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("fn_decidir_sugerencia", {
    p_sugerencia_id: sugerenciaId,
    p_accion: accion,
    p_valor: accion === "corregir" && valor !== null && !Number.isNaN(valor) ? valor : undefined,
    p_unidad: String(formData.get("unidad") ?? "").trim() || undefined,
    p_periodo: String(formData.get("periodo") ?? "").trim() || undefined,
    p_extracto: String(formData.get("extracto") ?? "").trim() || undefined,
    p_motivo: String(formData.get("motivo") ?? "").trim() || undefined,
  });
  if (error) {
    // Los mensajes de la función ya están escritos para el usuario.
    return { ok: false, mensaje: null, error: error.message };
  }

  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath(`/portal/solicitudes/${solicitudId}`);
  revalidatePath("/admin");
  revalidatePath("/portal");

  const estado = (data as { estado?: string } | null)?.estado ?? "";
  const clave = tipo === "texto" && estado !== "rechazada" ? `${estado}_texto` : estado;
  return { ok: true, mensaje: MENSAJES[clave] ?? "Decisión registrada.", error: null };
}
