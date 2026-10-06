"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ResumenState = { ok: boolean; error: string | null; recibir: boolean | null };

/**
 * El usuario enciende o apaga SU resumen diario. La regla vive en la base
 * (`fn_set_resumen_diario`, SECURITY DEFINER): solo su fila, nunca el auditor, y
 * la preferencia queda en bitácora. Aquí solo se traduce el error.
 */
export async function cambiarResumenDiario(recibir: boolean): Promise<ResumenState> {
  const db = await createClient();
  const { data, error } = await db.rpc("fn_set_resumen_diario", { p_recibir: recibir });
  if (error) {
    const auditor = error.message.includes("auditor");
    return {
      ok: false,
      recibir: null,
      error: auditor ? "El auditor externo no recibe resumen diario." : "No se pudo guardar tu preferencia.",
    };
  }
  revalidatePath("/portal/cuenta");
  revalidatePath("/admin/cuenta");
  return { ok: true, error: null, recibir: data as boolean };
}
