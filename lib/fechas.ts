// =============================================================================
// Formato de fechas humanizado, es-MX. Fuente única para TODA la UI.
//
// La BD almacena timestamps en UTC (correcto); esta capa de PRESENTACIÓN los
// convierte a la hora de México. Dos familias:
//   · Timestamps (instantes: created_at, updated_at, actividad) → se muestran en
//     America/Mexico_City. Es el fix del "servidor UTC muestra +6h".
//   · Fechas solo-día (calendario: fecha_limite, congelamiento) → deben mostrar
//     la MISMA fecha en cualquier servidor, sin corrimiento por zona horaria: se
//     interpretan como día UTC y se formatean en UTC (nunca restan/suman horas).
// =============================================================================

/** Zona horaria de presentación para timestamps. */
const TIME_ZONE = "America/Mexico_City";

// --- Timestamps (instantes) — en hora de México --------------------------------

/** "25 feb 2026" */
const fFecha = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

/** "25 de febrero de 2026" */
const fFechaLarga = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

/** "25 feb 2026, 14:30" */
const fFechaHora = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

function aDate(fecha: string | Date): Date {
  return fecha instanceof Date ? fecha : new Date(fecha);
}

/** Fecha corta de un TIMESTAMP: "25 feb 2026" (hora de México). */
export function fmtFecha(fecha: string | Date): string {
  return fFecha.format(aDate(fecha));
}

/** Fecha larga de un TIMESTAMP: "25 de febrero de 2026" (hora de México). */
export function fmtFechaLarga(fecha: string | Date): string {
  return fFechaLarga.format(aDate(fecha));
}

/** Fecha y hora de un TIMESTAMP: "25 feb 2026, 14:30" (hora de México). */
export function fmtFechaHora(fecha: string | Date): string {
  return fFechaHora.format(aDate(fecha));
}

// --- Fechas solo-día (calendario) — sin corrimiento por zona horaria -----------

const fDia = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const fDiaLargo = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Interpreta un ISO ('YYYY-MM-DD' o datetime) como el día UTC de sus primeros 10. */
function diaUTC(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

/** Fecha corta solo-día: "25 feb 2026" (misma fecha en cualquier servidor). */
export function fmtDia(iso: string): string {
  return fDia.format(diaUTC(iso));
}

/** Fecha larga solo-día: "25 de febrero de 2026" (misma fecha en cualquier servidor). */
export function fmtDiaLargo(iso: string): string {
  return fDiaLargo.format(diaUTC(iso));
}

/**
 * Tiempo relativo humanizado en es-MX: "hace un momento", "hace 5 min",
 * "hace 3 h", "ayer", "hace 4 días". Más allá de ~2 semanas cae a la fecha corta.
 * Opera sobre diferencias de instantes (independiente de zona horaria).
 */
export function relativo(fecha: string | Date): string {
  const d = aDate(fecha);
  const ms = Date.now() - d.getTime();
  const seg = Math.round(ms / 1000);
  const min = Math.round(seg / 60);
  const hrs = Math.round(min / 60);
  const dias = Math.round(hrs / 24);

  if (seg < 45) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  if (hrs < 24) return `hace ${hrs} h`;
  if (dias === 1) return "ayer";
  if (dias < 15) return `hace ${dias} días`;
  return fmtFecha(d);
}
