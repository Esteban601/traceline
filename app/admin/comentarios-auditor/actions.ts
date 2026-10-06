"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esAuditor } from "@/lib/data";
import { puedeResponderAuditor, type ObjetoAuditado } from "@/lib/comentarios-auditor";
import { registrarActividadAuditor } from "@/lib/auditoria";
import { avisarComentarioAuditor, avisarRespuestaAuditor } from "@/lib/notificaciones/inmediatos";

export type ComentarioState = { ok: boolean; error?: string | null };

const TIPOS: readonly ObjetoAuditado[] = [
  "solicitud",
  "registro_clima",
  "objetivo",
  "cuestionario",
];

const LARGO_MAX = 4000;

/**
 * El auditor deja un comentario sobre uno de los cuatro objetos revisables.
 *
 * Lo que NO se manda desde aquí: `tenant_id` y `autor_id` los calcula el trigger
 * de la base a partir del objeto y de auth.uid(). Se mandan igual porque la
 * política de INSERT exige `autor_id = auth.uid()` —comprobar la firma es de
 * RLS, calcularla es del trigger— y porque `tenant_id` es NOT NULL. Lo que la
 * aplicación escriba ahí lo sobrescribe la base: no puede mentir aunque quiera.
 */
export async function comentarComoAuditor(
  _prev: ComentarioState,
  formData: FormData
): Promise<ComentarioState> {
  const perfil = await getPerfilActual();
  if (!perfil) return { ok: false, error: "Sesión no válida." };
  if (!esAuditor(perfil) || perfil.tenant_id === null) {
    return { ok: false, error: "Solo el auditor externo escribe en este canal." };
  }

  const tipo = String(formData.get("objeto_tipo") ?? "") as ObjetoAuditado;
  const objetoId = String(formData.get("objeto_id") ?? "");
  const texto = String(formData.get("texto") ?? "").trim();

  if (!TIPOS.includes(tipo) || !objetoId) {
    return { ok: false, error: "No se pudo identificar qué estás comentando." };
  }
  if (!texto) return { ok: false, error: "Escribe tu comentario." };
  if (texto.length > LARGO_MAX) {
    return { ok: false, error: `El comentario no puede pasar de ${LARGO_MAX} caracteres.` };
  }

  const db = await createClient();
  const { data: creado, error } = await db
    .from("comentarios_auditor")
    .insert({
      objeto_tipo: tipo,
      objeto_id: objetoId,
      tenant_id: perfil.tenant_id,
      autor_id: perfil.id,
      texto,
    })
    .select("id")
    .single();

  if (error) {
    // El trigger rechaza un objeto inexistente o de otra emisora con
    // foreign_key_violation; el mensaje del motor no es para el usuario.
    console.error("[comentarios_auditor] insert falló:", error.message);
    return { ok: false, error: "No se pudo guardar el comentario." };
  }

  await registrarActividadAuditor(perfil, {
    tipo: "comentario",
    objetoTipo: tipo,
    objetoId,
  });

  // Aviso inmediato al administrador del cliente y al staff, después de
  // responder: el correo no frena la pantalla del auditor.
  after(() => avisarComentarioAuditor(creado.id));

  revalidatePath("/admin", "layout");
  return { ok: true, error: null };
}

/**
 * Staff o administrador del cliente responden. Cualquiera de los dos, sin
 * responsable único: así se decidió el 29/09/2026, y el contador de pendientes
 * es lo que evita que "de cualquiera" se vuelva "de nadie".
 *
 * Solo se manda `respuesta`. Quién respondió y cuándo los pone el trigger, así
 * que ni esta acción ni un POST forjado pueden atribuir una respuesta a otro.
 */
export async function responderComentarioAuditor(
  _prev: ComentarioState,
  formData: FormData
): Promise<ComentarioState> {
  const perfil = await getPerfilActual();
  if (!perfil) return { ok: false, error: "Sesión no válida." };
  if (!puedeResponderAuditor(perfil)) {
    return {
      ok: false,
      error: "Los comentarios del auditor los responde IRStrat o el administrador del cliente.",
    };
  }

  const id = String(formData.get("comentario_id") ?? "");
  const respuesta = String(formData.get("respuesta") ?? "").trim();
  if (!id) return { ok: false, error: "No se pudo identificar el comentario." };
  if (!respuesta) return { ok: false, error: "Escribe la respuesta." };
  if (respuesta.length > LARGO_MAX) {
    return { ok: false, error: `La respuesta no puede pasar de ${LARGO_MAX} caracteres.` };
  }

  const db = await createClient();
  const { data, error } = await db
    .from("comentarios_auditor")
    .update({ respuesta })
    .eq("id", id)
    .select("id");

  if (error) {
    // El trigger devuelve check_violation cuando ya estaba respondido; es el
    // único caso que el usuario puede provocar sin hacer nada raro (dos
    // pestañas), y merece su propia frase.
    const yaEstaba = error.message.includes("ya fue respondido");
    console.error("[comentarios_auditor] update falló:", error.message);
    return {
      ok: false,
      error: yaEstaba
        ? "Alguien más respondió ese comentario mientras escribías."
        : "No se pudo guardar la respuesta.",
    };
  }
  if (!data || data.length === 0) {
    // RLS filtró la fila: existe pero no es de su emisora.
    return { ok: false, error: "No se pudo guardar la respuesta." };
  }

  // Aviso inmediato al auditor que escribió el comentario.
  after(() => avisarRespuestaAuditor(id));

  revalidatePath("/admin", "layout");
  return { ok: true, error: null };
}
