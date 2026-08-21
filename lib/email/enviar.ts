import "server-only";
import { Resend } from "resend";
import type { Plantilla } from "./plantillas";

// =============================================================================
// Transporte de correo. Con RESEND_API_KEY presente, envía vía Resend. Sin ella,
// entra en MODO CONSOLA: imprime el correo en el log del servidor (nada se envía)
// para poder probar todo el flujo en local sin cuenta de Resend.
//
// REGLA DEL TRANSPORTE: enviar puede fallar, y un fallo de correo NO puede tumbar
// el acto que lo disparó. Una observación registrada sigue registrada aunque el
// aviso no salga; un recordatorio que no salió no borra la solicitud. Por eso esta
// función NUNCA lanza: devuelve `{ ok: false, error }` y quien la llama decide —y
// deja el intento en la bitácora, que es donde se ve después.
// =============================================================================

export type ResultadoEnvio = {
  ok: boolean;
  modo: "resend" | "consola";
  id?: string;
  error?: string;
};

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

/**
 * Techo de espera de un envío. Sin él, una llamada colgada a Resend deja colgada
 * la server action que la disparó —y con ella la pantalla de quien la usó—. El
 * correo puede llegar tarde; la interfaz no puede quedarse esperando.
 */
const TIMEOUT_MS = 10_000;

export function modoConsola(): boolean {
  return !API_KEY;
}

// Aviso de configuración, UNA vez por proceso: con clave real y sin EMAIL_FROM, el
// correo saldría desde el dominio de pruebas de Resend (onboarding@resend.dev) y
// llegaría como de un tercero. Es un error de despliegue, no de código, y hay que
// verlo en el log del arranque.
let avisoFromDado = false;
function avisarFrom() {
  if (avisoFromDado || !API_KEY) return;
  avisoFromDado = true;
  if (!process.env.EMAIL_FROM) {
    console.warn(
      "[email] RESEND_API_KEY está definida pero EMAIL_FROM no: los correos saldrán " +
        `desde ${FROM} (dominio de pruebas de Resend). Define EMAIL_FROM con un ` +
        "remitente de tu dominio verificado."
    );
  }
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

  avisarFrom();

  try {
    const resend = new Resend(API_KEY);
    const envio = resend.emails.send({
      from: FROM,
      to,
      subject: plantilla.subject,
      html: plantilla.html,
    });
    // `Promise.race` con el reloj: si Resend no contesta, se devuelve el fallo y el
    // flujo sigue. La petición puede completarse después —el correo llegaría—, y
    // por eso el mensaje dice "sin respuesta", no "no se envió".
    const resultado = await Promise.race([
      envio,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Resend no respondió en ${TIMEOUT_MS / 1000}s`)),
          TIMEOUT_MS
        )
      ),
    ]);
    const { data, error } = resultado as Awaited<typeof envio>;
    if (error) {
      // El objeto de error de Resend trae `name` (p. ej. 'validation_error',
      // 'rate_limit_exceeded'): sin él, "Invalid email" no dice de qué lado está
      // el problema.
      const detalle = [error.name, error.message].filter(Boolean).join(": ");
      console.error(`[email] Resend rechazó el envío a ${to}: ${detalle}`);
      return { ok: false, modo: "resend", error: detalle || "Resend rechazó el envío." };
    }
    return { ok: true, modo: "resend", id: data?.id };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error desconocido al enviar.";
    console.error(`[email] fallo de transporte enviando a ${to}: ${mensaje}`);
    return { ok: false, modo: "resend", error: mensaje };
  }
}
