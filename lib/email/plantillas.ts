import { APP_NAME, APP_URL } from "@/lib/app";
import { fmtDiaLargo, fmtFechaHora } from "@/lib/fechas";

// =============================================================================
// Plantillas HTML de correo — alineadas al DESIGN.md (crema/teal/dorado), con
// tipografía system-safe (los clientes de correo no cargan Sora/Inter) y CSS
// EN LÍNEA (Gmail/Outlook descartan <style> y clases). Layout basado en tablas.
// =============================================================================

const COLOR = {
  crema: "#F7F3EA",
  surface: "#FEFCF6",
  line: "#E7DECB",
  ink: "#1C2B28",
  muted: "#5F6E6A",
  teal: "#0E4F47",
  tealDark: "#0A3A34",
  gold: "#BE9130",
  rojo: "#B0402F",
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type SolicitudEmail = {
  id: string;
  titulo: string;
  fechaLimite: string | null; // ISO date (YYYY-MM-DD) o null
  esObservacion?: boolean;
};

function limpiarNombre(nombre: string): string {
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fechaTexto(iso: string | null): string {
  if (!iso) return "Sin fecha límite";
  return `Vence el ${fmtDiaLargo(iso)}`;
}

function boton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;">
      <tr>
        <td style="border-radius:10px;background:${COLOR.teal};">
          <a href="${esc(href)}" target="_blank"
             style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:${COLOR.crema};text-decoration:none;border-radius:10px;">
            ${esc(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

function itemSolicitud(s: SolicitudEmail): string {
  const destacada = s.esObservacion;
  const borde = destacada ? COLOR.rojo : COLOR.line;
  const badge = destacada
    ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#F6E4E0;color:${COLOR.rojo};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">Observación</span>`
    : "";
  return `
    <tr>
      <td style="padding:12px 16px;border:1px solid ${borde};border-radius:12px;background:${COLOR.surface};">
        <div style="font-family:${FONT};font-size:15px;font-weight:600;color:${COLOR.ink};line-height:1.4;">
          ${esc(s.titulo)}${badge}
        </div>
        <div style="font-family:${FONT};font-size:13px;color:${COLOR.muted};margin-top:4px;">
          ${esc(fechaTexto(s.fechaLimite))}
        </div>
      </td>
    </tr>
    <tr><td style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`;
}

function urlSolicitud(id: string): string {
  return `${APP_URL}/portal/solicitudes/${id}`;
}
function urlPortal(): string {
  return `${APP_URL}/portal`;
}

/** Envuelve el contenido en el layout institucional (crema + tarjeta + pie). */
function layout(opts: {
  preheader: string;
  etiqueta: string;
  titulo: string;
  cuerpoHtml: string;
}): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${COLOR.crema};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.crema};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Cabecera -->
        <tr><td style="padding:8px 8px 20px 8px;">
          <span style="font-family:${FONT};font-size:18px;font-weight:700;color:${COLOR.teal};letter-spacing:-0.01em;">${esc(APP_NAME)}</span>
        </td></tr>
        <!-- Tarjeta -->
        <tr><td style="background:${COLOR.surface};border:1px solid ${COLOR.line};border-radius:16px;padding:28px 28px 24px 28px;">
          <div style="font-family:${FONT};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:${COLOR.gold};">${esc(opts.etiqueta)}</div>
          <h1 style="font-family:${FONT};font-size:22px;font-weight:700;color:${COLOR.ink};margin:10px 0 16px 0;line-height:1.3;">${esc(opts.titulo)}</h1>
          ${opts.cuerpoHtml}
        </td></tr>
        <!-- Pie institucional -->
        <tr><td style="padding:20px 8px;font-family:${FONT};font-size:12px;color:${COLOR.muted};line-height:1.6;">
          Este mensaje fue enviado por <strong style="color:${COLOR.ink};">${esc(APP_NAME)}</strong>,
          plataforma de trazabilidad de evidencia de sostenibilidad (NIIF S1/S2).<br>
          Si no esperabas este correo, puedes ignorarlo.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function saludo(nombre: string): string {
  return `<p style="font-family:${FONT};font-size:15px;color:${COLOR.ink};margin:0 0 14px 0;line-height:1.6;">Hola, ${esc(limpiarNombre(nombre))}:</p>`;
}

function listaSolicitudes(sols: SolicitudEmail[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 8px 0;">${sols
    .map(itemSolicitud)
    .join("")}</table>`;
}

export type Plantilla = { subject: string; html: string };

/** (a) Solicitud de información. Una o varias solicitudes para una persona. */
export function plantillaSolicitud(nombre: string, sols: SolicitudEmail[]): Plantilla {
  const n = sols.length;
  const subject =
    n === 1
      ? `Solicitud de información: ${sols[0].titulo}`
      : `${n} solicitudes de información pendientes`;
  const intro =
    n === 1
      ? `Te solicitamos la siguiente información para el Informe Anual Sustentable. Ábrela para cargar la evidencia correspondiente:`
      : `Te solicitamos la siguiente información para el Informe Anual Sustentable. Ábrelas en tu portal para cargar la evidencia correspondiente:`;
  const cta =
    n === 1 ? boton(urlSolicitud(sols[0].id), "Abrir solicitud") : boton(urlPortal(), "Ir a mi portal");
  const cuerpoHtml = `
    ${saludo(nombre)}
    <p style="font-family:${FONT};font-size:15px;color:${COLOR.ink};margin:0 0 16px 0;line-height:1.6;">${intro}</p>
    ${listaSolicitudes(sols)}
    ${cta}`;
  return {
    subject,
    html: layout({
      preheader: intro,
      etiqueta: "Solicitud de información",
      titulo: n === 1 ? "Tienes una solicitud de información" : "Tienes solicitudes de información",
      cuerpoHtml,
    }),
  };
}

/** (b) Recordatorio semanal (digest). Observaciones destacadas. */
export function plantillaRecordatorio(nombre: string, sols: SolicitudEmail[]): Plantilla {
  const n = sols.length;
  const conObs = sols.filter((s) => s.esObservacion).length;
  const subject = `Recordatorio: ${n} ${n === 1 ? "solicitud pendiente" : "solicitudes pendientes"}${
    conObs > 0 ? ` (${conObs} con observaciones)` : ""
  }`;
  const intro = `Este es el resumen de la información que tienes pendiente de entregar o corregir para el Informe Anual Sustentable.`;
  const nota =
    conObs > 0
      ? `<p style="font-family:${FONT};font-size:14px;color:${COLOR.rojo};margin:0 0 14px 0;line-height:1.6;">Hay ${conObs} ${
          conObs === 1 ? "solicitud" : "solicitudes"
        } con observaciones que requieren tu corrección (marcadas abajo).</p>`
      : "";
  const cuerpoHtml = `
    ${saludo(nombre)}
    <p style="font-family:${FONT};font-size:15px;color:${COLOR.ink};margin:0 0 12px 0;line-height:1.6;">${intro}</p>
    ${nota}
    ${listaSolicitudes(sols)}
    ${boton(urlPortal(), "Revisar mis pendientes")}`;
  return {
    subject,
    html: layout({
      preheader: intro,
      etiqueta: "Recordatorio",
      titulo: "Tienes información pendiente",
      cuerpoHtml,
    }),
  };
}

/** (c) Aviso de observación sobre una solicitud específica. */
export function plantillaObservacion(
  nombre: string,
  sol: SolicitudEmail,
  observacion: string
): Plantilla {
  const subject = `Observación sobre: ${sol.titulo}`;
  const intro = `El equipo de IRStrat registró una observación sobre una de tus solicitudes. Requiere tu atención:`;
  const cuerpoHtml = `
    ${saludo(nombre)}
    <p style="font-family:${FONT};font-size:15px;color:${COLOR.ink};margin:0 0 16px 0;line-height:1.6;">${intro}</p>
    ${listaSolicitudes([{ ...sol, esObservacion: true }])}
    <div style="font-family:${FONT};font-size:14px;color:${COLOR.ink};background:#F6E4E0;border-left:3px solid ${COLOR.rojo};border-radius:8px;padding:12px 14px;margin:4px 0 16px 0;line-height:1.6;">
      <strong style="color:${COLOR.rojo};">Observación:</strong><br>${esc(observacion).replace(/\n/g, "<br>")}
    </div>
    ${boton(urlSolicitud(sol.id), "Ver y corregir")}`;
  return {
    subject,
    html: layout({
      preheader: intro,
      etiqueta: "Observación",
      titulo: "Una solicitud requiere corrección",
      cuerpoHtml,
    }),
  };
}

/**
 * (d) Invitación de acceso. Lleva a establecer la contraseña propia mediante una
 * liga de un solo uso con expiración. Queda implementada para cuando exista la
 * cuenta real de Resend; en modo consola el correo se imprime en el log y la vía
 * operativa es la liga que el panel le muestra al staff.
 */
export function plantillaInvitacion(
  nombre: string,
  opts: { url: string; expiraEn: string; cliente: string; horas: number }
): Plantilla {
  const subject = `Tu acceso a ${APP_NAME}`;
  const intro = `Te damos acceso al portal de evidencia de sostenibilidad de ${limpiarNombre(
    opts.cliente
  )}. Para entrar, establece tu contraseña:`;
  const cuerpoHtml = `
    ${saludo(nombre)}
    <p style="font-family:${FONT};font-size:15px;color:${COLOR.ink};margin:0 0 16px 0;line-height:1.6;">${esc(
      intro
    )}</p>
    ${boton(opts.url, "Establecer mi contraseña")}
    <p style="font-family:${FONT};font-size:13px;color:${COLOR.muted};margin:14px 0 0 0;line-height:1.6;">
      La liga sirve <strong style="color:${COLOR.ink};">una sola vez</strong> y vence
      el ${esc(fmtFechaHora(opts.expiraEn))} (${opts.horas} horas).
      Si vence, pídele al equipo de IRStrat que te genere una nueva.
    </p>`;
  return {
    subject,
    html: layout({
      preheader: intro,
      etiqueta: "Invitación de acceso",
      titulo: "Establece tu contraseña",
      cuerpoHtml,
    }),
  };
}
