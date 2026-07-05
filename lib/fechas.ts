// =============================================================================
// Formato de fechas humanizado, es-MX. Fuente única para toda la UI.
// =============================================================================

/** "25 feb 2026" */
const fFecha = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "25 de febrero de 2026" */
const fFechaLarga = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "25 feb 2026, 14:30" */
const fFechaHora = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function aDate(fecha: string | Date): Date {
  return fecha instanceof Date ? fecha : new Date(fecha);
}

/** Fecha corta: "25 feb 2026". Acepta ISO datetime o date-only. */
export function fmtFecha(fecha: string | Date): string {
  return fFecha.format(aDate(fecha));
}

/** Fecha larga: "25 de febrero de 2026". */
export function fmtFechaLarga(fecha: string | Date): string {
  return fFechaLarga.format(aDate(fecha));
}

/** Fecha y hora: "25 feb 2026, 14:30". */
export function fmtFechaHora(fecha: string | Date): string {
  return fFechaHora.format(aDate(fecha));
}

/** Convierte una fecha date-only ('YYYY-MM-DD') a Date en medianoche local. */
export function deFechaLocal(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/**
 * Tiempo relativo humanizado en es-MX: "hace un momento", "hace 5 min",
 * "hace 3 h", "ayer", "hace 4 días". Más allá de ~2 semanas cae a la fecha corta.
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
