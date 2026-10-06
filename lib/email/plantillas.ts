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

/**
 * (c) Aviso de observación sobre una solicitud específica.
 *
 * `autor` dice QUIÉN la registró, y no es un adorno: desde el tier de autoservicio
 * una observación puede venir del administrador del propio cliente, y este correo
 * es el único canal que sale de la plataforma. Atribuírsela a IRStrat sería la
 * única pieza del sprint que miente sobre el origen.
 */
export function plantillaObservacion(
  nombre: string,
  sol: SolicitudEmail,
  observacion: string,
  autor: { esIrstrat: boolean; organizacion?: string | null } = { esIrstrat: true }
): Plantilla {
  const subject = `Observación sobre: ${sol.titulo}`;
  const quien = autor.esIrstrat
    ? "El equipo de IRStrat"
    : `El equipo de ${limpiarNombre(autor.organizacion ?? "tu organización")}`;
  const intro = `${quien} registró una observación sobre una de tus solicitudes. Requiere tu atención:`;
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
 * (c-bis) Recordatorio PROGRAMADO de una solicitud: a N días de su fecha límite.
 *
 * Es distinto del digest (c): habla de UNA solicitud, dice cuánto falta y en qué
 * estado está —qué falta exactamente—, y lleva directo a ella, no al tablero. Se
 * dispara por el calendario que alguien configuró, no por la acumulación de
 * pendientes, así que el asunto empieza por el plazo: es la información por la que
 * se abre (o no) el correo.
 */
export function plantillaRecordatorioProgramado(
  nombre: string,
  sol: SolicitudEmail,
  opts: { diasAntes: number; estadoLabel: string; queFalta: string }
): Plantilla {
  const plazo =
    opts.diasAntes === 1 ? "Vence mañana" : `Faltan ${opts.diasAntes} días`;
  const subject = `${plazo}: ${sol.titulo}`;
  const intro = `${plazo} el plazo de una solicitud del Informe Anual Sustentable.`;
  const cuerpoHtml = `
    ${saludo(nombre)}
    <p style="font-family:${FONT};font-size:15px;color:${COLOR.ink};margin:0 0 14px 0;line-height:1.6;">${esc(
      intro
    )}</p>
    ${listaSolicitudes([sol])}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 16px 0;">
      <tr>
        <td style="padding:12px 14px;border-left:3px solid ${COLOR.gold};border-radius:8px;background:${COLOR.crema};font-family:${FONT};font-size:14px;color:${COLOR.ink};line-height:1.6;">
          <strong style="color:${COLOR.ink};">Estado hoy:</strong> ${esc(opts.estadoLabel)}<br>
          ${esc(opts.queFalta)}
        </td>
      </tr>
    </table>
    ${boton(urlSolicitud(sol.id), "Abrir la solicitud")}`;
  return {
    subject,
    html: layout({
      preheader: intro,
      etiqueta: "Recordatorio",
      titulo: opts.diasAntes === 1 ? "Tu entrega vence mañana" : `Tu entrega vence en ${opts.diasAntes} días`,
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
      Si vence, pídele una nueva a quien te dio el acceso.
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

// =============================================================================
// AVISOS INMEDIATOS (encargo sistema de alertas, Paso 1). Lo conversacional:
// alguien escribió o espera respuesta. El asunto empieza por la emisora —quien
// recibe puede atender a varias— y el botón lleva al objeto en el PANEL, que es
// donde viven el canal del auditor y la revisión del documento.
// =============================================================================

export type ObjetoAviso = {
  /** «la solicitud», «el registro climático»… — para la frase. */
  etiqueta: string;
  /** Título visible del objeto. */
  titulo: string;
  /** Ruta del panel, relativa (p. ej. `/admin/solicitudes/<id>`). */
  ruta: string;
};

function urlPanel(ruta: string): string {
  return `${APP_URL}${ruta}`;
}

function cita(texto: string, opts: { etiqueta: string; color: string; fondo: string }): string {
  return `
    <div style="font-family:${FONT};font-size:14px;color:${COLOR.ink};background:${opts.fondo};border-left:3px solid ${opts.color};border-radius:8px;padding:12px 14px;margin:4px 0 16px 0;line-height:1.6;">
      <strong style="color:${opts.color};">${esc(opts.etiqueta)}</strong><br>${esc(texto).replace(/\n/g, "<br>")}
    </div>`;
}

function fichaObjeto(obj: ObjetoAviso): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 8px 0;">
    <tr>
      <td style="padding:12px 16px;border:1px solid ${COLOR.line};border-radius:12px;background:${COLOR.surface};">
        <div style="font-family:${FONT};font-size:12px;color:${COLOR.muted};text-transform:uppercase;letter-spacing:.06em;">${esc(obj.etiqueta)}</div>
        <div style="font-family:${FONT};font-size:15px;font-weight:600;color:${COLOR.ink};line-height:1.4;margin-top:2px;">${esc(obj.titulo)}</div>
      </td>
    </tr>
    <tr><td style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>
  </table>`;
}

/** (e) El auditor externo comentó: al administrador del cliente y al staff. */
export function plantillaComentarioAuditor(
  nombre: string,
  opts: { emisora: string; objeto: ObjetoAviso; texto: string }
): Plantilla {
  const emisora = limpiarNombre(opts.emisora);
  const subject = `${emisora} · Comentario del auditor externo`;
  const intro = `El auditor externo dejó un comentario sobre ${opts.objeto.etiqueta} de ${emisora}. Espera respuesta en la plataforma.`;
  const cuerpoHtml = `
    ${saludo(nombre)}
    <p style="font-family:${FONT};font-size:15px;color:${COLOR.ink};margin:0 0 16px 0;line-height:1.6;">${esc(intro)}</p>
    ${fichaObjeto(opts.objeto)}
    ${cita(opts.texto, { etiqueta: "Comentario:", color: COLOR.gold, fondo: COLOR.crema })}
    ${boton(urlPanel(opts.objeto.ruta), "Ver y responder")}`;
  return {
    subject,
    html: layout({ preheader: intro, etiqueta: "Auditor externo", titulo: "Hay un comentario del auditor", cuerpoHtml }),
  };
}

/** (f) Respondieron un comentario del auditor: a quien lo escribió. */
export function plantillaRespuestaAuditor(
  nombre: string,
  opts: { emisora: string; objeto: ObjetoAviso; comentario: string; respuesta: string }
): Plantilla {
  const emisora = limpiarNombre(opts.emisora);
  const subject = `${emisora} · Respondieron tu comentario`;
  const intro = `Tu comentario sobre ${opts.objeto.etiqueta} de ${emisora} tiene respuesta.`;
  const cuerpoHtml = `
    ${saludo(nombre)}
    <p style="font-family:${FONT};font-size:15px;color:${COLOR.ink};margin:0 0 16px 0;line-height:1.6;">${esc(intro)}</p>
    ${fichaObjeto(opts.objeto)}
    ${cita(opts.comentario, { etiqueta: "Tu comentario:", color: COLOR.muted, fondo: COLOR.crema })}
    ${cita(opts.respuesta, { etiqueta: "Respuesta:", color: COLOR.teal, fondo: "#E6EFEC" })}
    ${boton(urlPanel(opts.objeto.ruta), "Ver en la plataforma")}`;
  return {
    subject,
    html: layout({ preheader: intro, etiqueta: "Auditor externo", titulo: "Respondieron tu comentario", cuerpoHtml }),
  };
}

/** (g) El documento del Suplemento quedó aprobado: al administrador del cliente. */
export function plantillaDocumentoAprobado(
  nombre: string,
  opts: { emisora: string; documento: string; ejercicio: number | null; ruta: string }
): Plantilla {
  const emisora = limpiarNombre(opts.emisora);
  const subject = `${emisora} · Suplemento NIIF S1/S2 aprobado`;
  const intro = `IRStrat aprobó el Suplemento NIIF S1/S2${opts.ejercicio ? ` del ejercicio ${opts.ejercicio}` : ""} de ${emisora}. Ya puedes revisarlo y descargarlo.`;
  const cuerpoHtml = `
    ${saludo(nombre)}
    <p style="font-family:${FONT};font-size:15px;color:${COLOR.ink};margin:0 0 16px 0;line-height:1.6;">${esc(intro)}</p>
    ${fichaObjeto({ etiqueta: "Documento", titulo: limpiarNombre(opts.documento), ruta: opts.ruta })}
    ${boton(urlPanel(opts.ruta), "Abrir el documento")}`;
  return {
    subject,
    html: layout({ preheader: intro, etiqueta: "Suplemento", titulo: "Tu Suplemento está aprobado", cuerpoHtml }),
  };
}

// =============================================================================
// RESUMEN DIARIO (encargo sistema de alertas, Paso 2). Sustituye al digest de
// pendientes: el mismo correo, ahora por persona y con secciones. Una sección
// vacía no se pinta; un resumen sin secciones no se manda (eso lo decide quien
// arma las secciones, no la plantilla).
// =============================================================================

export type ItemResumen = {
  titulo: string;
  /** Línea secundaria: plazo, área, «nuevo desde ayer»… */
  nota?: string | null;
  /** Ruta relativa (portal o panel, según quien recibe). */
  ruta?: string | null;
  destacado?: boolean;
};

export type SeccionResumen = {
  clave: string;
  titulo: string;
  /** Una frase de qué se espera de quien lee. */
  intro: string;
  items: ItemResumen[];
};

const MAX_ITEMS_POR_SECCION = 10;

function itemResumen(it: ItemResumen): string {
  const titulo = it.ruta
    ? `<a href="${esc(urlPanel(it.ruta))}" target="_blank" style="color:${COLOR.ink};text-decoration:none;">${esc(it.titulo)}</a>`
    : esc(it.titulo);
  return `
    <tr>
      <td style="padding:10px 14px;border:1px solid ${it.destacado ? COLOR.gold : COLOR.line};border-radius:10px;background:${COLOR.surface};">
        <div style="font-family:${FONT};font-size:14px;font-weight:600;color:${COLOR.ink};line-height:1.4;">${titulo}</div>
        ${it.nota ? `<div style="font-family:${FONT};font-size:12px;color:${COLOR.muted};margin-top:3px;">${esc(it.nota)}</div>` : ""}
      </td>
    </tr>
    <tr><td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>`;
}

function seccionResumen(s: SeccionResumen): string {
  // Lo nuevo primero: con más de MAX ítems, la novedad no puede quedar en «y N más».
  const ordenados = [...s.items.filter((i) => i.destacado), ...s.items.filter((i) => !i.destacado)];
  const visibles = ordenados.slice(0, MAX_ITEMS_POR_SECCION);
  const resto = s.items.length - visibles.length;
  return `
    <div style="margin:18px 0 6px 0;">
      <div style="font-family:${FONT};font-size:15px;font-weight:700;color:${COLOR.teal};">
        ${esc(s.titulo)} <span style="font-weight:600;color:${COLOR.muted};">· ${s.items.length}</span>
      </div>
      <div style="font-family:${FONT};font-size:13px;color:${COLOR.muted};margin:3px 0 10px 0;line-height:1.5;">${esc(s.intro)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${visibles.map(itemResumen).join("")}</table>
      ${resto > 0 ? `<div style="font-family:${FONT};font-size:13px;color:${COLOR.muted};">y ${resto} más en la plataforma.</div>` : ""}
    </div>`;
}

/** Resumen diario de una persona de UNA emisora (cliente, jefe, admin del cliente). */
export function plantillaResumenDiario(
  nombre: string,
  opts: { emisora: string; secciones: SeccionResumen[]; rutaInicio: string }
): Plantilla {
  const emisora = limpiarNombre(opts.emisora);
  const total = opts.secciones.reduce((n, s) => n + s.items.length, 0);
  const subject = `${emisora} · Resumen diario`;
  const intro = `Lo que tienes pendiente y lo que cambió ayer en ${emisora}.`;
  const cuerpoHtml = `
    ${saludo(nombre)}
    <p style="font-family:${FONT};font-size:15px;color:${COLOR.ink};margin:0 0 6px 0;line-height:1.6;">${esc(intro)}</p>
    ${opts.secciones.map(seccionResumen).join("")}
    <div style="height:10px;"></div>
    ${boton(urlPanel(opts.rutaInicio), "Abrir la plataforma")}
    <p style="font-family:${FONT};font-size:12px;color:${COLOR.muted};margin:14px 0 0 0;line-height:1.6;">
      Recibes este resumen porque lo tienes encendido en «Mi cuenta». Puedes apagarlo ahí; los avisos
      de comentarios y aprobaciones te seguirán llegando.
    </p>`;
  return {
    subject,
    html: layout({
      preheader: `${total} ${total === 1 ? "elemento" : "elementos"} · ${intro}`,
      etiqueta: "Resumen diario",
      titulo: emisora,
      cuerpoHtml,
    }),
  };
}

/** Resumen diario del staff: un solo correo con secciones por emisora real. */
export function plantillaResumenStaff(
  nombre: string,
  opts: { emisoras: { nombre: string; secciones: SeccionResumen[] }[] }
): Plantilla {
  const n = opts.emisoras.length;
  const subject = `${APP_NAME} · Resumen diario · ${n} ${n === 1 ? "emisora" : "emisoras"}`;
  const intro = `Lo que espera la validación de IRStrat en ${n} ${n === 1 ? "emisora" : "emisoras"}.`;
  const bloques = opts.emisoras
    .map(
      (e) => `
    <div style="margin:22px 0 4px 0;padding-top:14px;border-top:1px solid ${COLOR.line};">
      <div style="font-family:${FONT};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:${COLOR.gold};">Emisora</div>
      <div style="font-family:${FONT};font-size:18px;font-weight:700;color:${COLOR.ink};margin-top:2px;">${esc(limpiarNombre(e.nombre))}</div>
      ${e.secciones.map(seccionResumen).join("")}
    </div>`
    )
    .join("");
  const cuerpoHtml = `
    ${saludo(nombre)}
    <p style="font-family:${FONT};font-size:15px;color:${COLOR.ink};margin:0 0 6px 0;line-height:1.6;">${esc(intro)}</p>
    ${bloques}
    <div style="height:10px;"></div>
    ${boton(urlPanel("/admin"), "Abrir el panel")}
    <p style="font-family:${FONT};font-size:12px;color:${COLOR.muted};margin:14px 0 0 0;line-height:1.6;">
      Solo emisoras reales; las de demostración no entran en este resumen. Puedes apagarlo en «Mi cuenta».
    </p>`;
  return {
    subject,
    html: layout({ preheader: intro, etiqueta: "Resumen diario", titulo: "Pendientes de validación", cuerpoHtml }),
  };
}
