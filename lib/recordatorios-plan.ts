// =============================================================================
// Plan de recordatorios de una solicitud — constantes y reglas COMPARTIDAS entre
// el formulario (cliente) y las server actions / el cron (servidor). Sin
// "server-only" a propósito: la UI tiene que reflejar exactamente los mismos
// límites que la base valida, o el usuario descubre la regla por un error.
// =============================================================================

/** Intervalos ofrecidos como casilla marcable, en días antes de la fecha límite. */
export const PRESETS_RECORDATORIO = [7, 3, 1] as const;

/**
 * Los que nacen ENCENDIDOS: una semana antes (da tiempo a juntar la evidencia) y
 * el día previo (el empujón). El de 3 días se ofrece apagado para no convertir
 * cada solicitud en tres correos por default.
 */
export const PRESETS_DEFAULT_ACTIVOS = [7, 1] as const;

/** Cotas: las mismas que los CHECK de `solicitudes_recordatorios`. */
export const DIAS_ANTES_MIN = 1;
export const DIAS_ANTES_MAX = 365;

/** Cuántos recordatorios se admiten por solicitud (evita el formulario infinito). */
export const MAX_RECORDATORIOS = 8;

export type PlanRecordatorio = { dias: number; activo: boolean };

/** Error legible del intervalo capturado a mano, o null si es válido. */
export function errorDiasAntes(dias: number): string | null {
  if (!Number.isInteger(dias)) return "Los días tienen que ser un número entero.";
  if (dias < DIAS_ANTES_MIN) {
    return "El recordatorio va ANTES de la fecha límite: mínimo 1 día.";
  }
  if (dias > DIAS_ANTES_MAX) return `Máximo ${DIAS_ANTES_MAX} días antes.`;
  return null;
}

/** «7 días antes» / «1 día antes» — la etiqueta que ve la persona. */
export function etiquetaDias(dias: number): string {
  return dias === 1 ? "1 día antes" : `${dias} días antes`;
}

/**
 * Cuándo se manda un recordatorio, en fecha local (YYYY-MM-DD). Se calcula sobre
 * la fecha PELADA, sin husos: `fecha_limite` es un `date` y restarle días en UTC
 * y volver a formatear en local corría la fecha un día en México — el bug de zona
 * que ya se corrigió una vez en las fechas del portal.
 */
export function fechaDisparo(fechaLimite: string, diasAntes: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaLimite);
  if (!m) return null;
  const [, a, mes, d] = m;
  // Date.UTC + getUTC* mantiene la aritmética en el mismo calendario con el que
  // entró: puro conteo de días, sin husos de por medio.
  const t = Date.UTC(Number(a), Number(mes) - 1, Number(d)) - diasAntes * 86_400_000;
  const f = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${f.getUTCFullYear()}-${p(f.getUTCMonth() + 1)}-${p(f.getUTCDate())}`;
}

/**
 * Normaliza lo que llega del formulario: enteros únicos, ordenados de mayor a
 * menor (el orden en que ocurren) y acotados. Devuelve solo los ACTIVOS: los
 * demás se apagan por diferencia contra lo que ya existe.
 */
export function normalizarDias(valores: (string | number)[]): number[] {
  const set = new Set<number>();
  for (const v of valores) {
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (!Number.isInteger(n) || errorDiasAntes(n)) continue;
    set.add(n);
  }
  return [...set].sort((a, b) => b - a).slice(0, MAX_RECORDATORIOS);
}
