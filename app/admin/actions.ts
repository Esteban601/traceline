"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPerfilActual, esStaff } from "@/lib/data";
import { enviarSolicitudesCore, type ResumenSolicitud } from "@/lib/solicitar";
import { procesarRecordatorios, type ResumenRecordatorios } from "@/lib/recordatorios";

/**
 * Envía solicitudes (individual o masivo). Agrupa por responsable → un correo
 * por persona. Se ejecuta como el staff (sesión); RLS permite leer/actualizar.
 */
export async function enviarSolicitudesMasivo(
  ids: string[]
): Promise<ResumenSolicitud & { error?: string }> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return {
      modo: "consola",
      correos: 0,
      solicitudes: 0,
      omitidas: 0,
      fallidos: 0,
      detalles: [],
      error: "Acción reservada al equipo de IRStrat.",
    };
  }

  const db = await createClient();
  const resumen = await enviarSolicitudesCore(db, perfil.id, ids);
  revalidatePath("/admin");
  return resumen;
}

/**
 * Dispara los recordatorios desde el panel (botón manual). Usa la MISMA rutina
 * que el endpoint del cron, pero server-side y protegida por sesión de staff
 * (no expone CRON_SECRET al navegador).
 */
export async function dispararRecordatorios(): Promise<
  ResumenRecordatorios & { error?: string }
> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return {
      modo: "consola",
      enviados: 0,
      omitidos: 0,
      fallidos: 0,
      responsables: 0,
      detalles: [],
      error: "Acción reservada al equipo de IRStrat.",
    };
  }

  const db = createAdminClient();
  const resumen = await procesarRecordatorios(db);
  revalidatePath("/admin");
  return resumen;
}
