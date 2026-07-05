import "server-only";
import { Resend } from "resend";
import type { Plantilla } from "./plantillas";

// =============================================================================
// Transporte de correo. Con RESEND_API_KEY presente, envía vía Resend. Sin ella,
// entra en MODO CONSOLA: imprime el correo en el log del servidor (nada se envía)
// para poder probar todo el flujo en local sin cuenta de Resend.
// =============================================================================

export type ResultadoEnvio = {
  ok: boolean;
  modo: "resend" | "consola";
  id?: string;
  error?: string;
};

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

export function modoConsola(): boolean {
  return !API_KEY;
}

export async function enviarCorreo(
  to: string,
  plantilla: Plantilla
): Promise<ResultadoEnvio> {
  if (!API_KEY) {
    // MODO CONSOLA — resumen legible en el log del servidor.
    console.log(
      [
        "",
        "════════════════════ 📧 CORREO (modo consola) ════════════════════",
        `  Para:   ${to}`,
        `  De:     ${FROM}`,
        `  Asunto: ${plantilla.subject}`,
        "  (RESEND_API_KEY ausente → no se envía; define la clave para enviar)",
        "───────────────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
    return { ok: true, modo: "consola" };
  }

  try {
    const resend = new Resend(API_KEY);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject: plantilla.subject,
      html: plantilla.html,
    });
    if (error) {
      return { ok: false, modo: "resend", error: error.message };
    }
    return { ok: true, modo: "resend", id: data?.id };
  } catch (e) {
    return {
      ok: false,
      modo: "resend",
      error: e instanceof Error ? e.message : "Error desconocido al enviar.",
    };
  }
}
