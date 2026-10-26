import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { cargarSugerencia, type BloqueSugerencia } from "@/lib/evidencias/sugerencia-vista";
import { evidenciasConCifra } from "@/lib/evidencias/con-cifra";
import { LINEA_SIN_TOTAL, lineaSinHallazgo } from "@/lib/evidencias/lineas";

// =============================================================================
// ESTADO DE LA LECTURA DE UNA EVIDENCIA, PARA LA CARGA EN DOS MOMENTOS
// (encargo 2026-10-26-carga-lectura-primero).
//
// Archivo y periodo → «Subir y leer» → la pantalla consulta esto cada 4 s hasta
// 90 s → paso 3 prellenado con la sugerencia, o el paso 3 manual con la línea de
// por qué no hay sugerencia. Sale del estado en la base, no del navegador: si
// quien carga recarga o vuelve más tarde, la última evidencia sin cifra
// confirmada vuelve a mostrar el paso 3.
//
// Con la sesión de quien mira: RLS (fn_puede_ver_solicitud) acota la lectura y
// la sugerencia igual que el resto de la pantalla.
// =============================================================================

type Db = Awaited<ReturnType<typeof createClient>>;

export type FaseLectura =
  | "leyendo" // pendiente o en proceso, o leída y con la sugerencia en camino
  | "tarda" // «leyendo» pasados los 90 s
  | "sugerida" // hay una cifra sugerida para confirmar o corregir
  | "sin_hallazgo" // la lectura no encontró la cifra
  | "rechazada" // quien carga rechazó la sugerida
  | "apagada" // la lectura está apagada para la emisora
  | "tope" // se alcanzó el tope mensual de lecturas
  | "fallo" // error técnico, formato que no se lee o sugerencia fallida
  | "sin_lectura" // evidencia anterior a la lectura: no tiene fila
  | "con_cifra"; // la evidencia ya tiene su cifra confirmada

export type EstadoLectura = {
  fase: FaseLectura;
  evidenciaId: string;
  /** La línea que ve el usuario cuando no hay sugerencia que confirmar. */
  linea: string | null;
  /** Segundos desde que se encoló la lectura (para el tope de 90 s del sondeo). */
  segundos: number | null;
  bloque: BloqueSugerencia | null;
};

/** El sondeo deja de esperar a los 90 s. */
export const ESPERA_MAX_S = 90;

const LINEAS: Partial<Record<FaseLectura, string>> = {
  tarda: "La lectura de tu archivo sigue en curso. Escribe la cifra o vuelve en unos minutos para confirmar la que encontremos.",
  rechazada: "Rechazaste la cifra que encontramos. Escríbela tú.",
  apagada: "La lectura automática de archivos no está activa para tu empresa. Escribe la cifra.",
  tope: "Este mes ya se usaron todas las lecturas automáticas de tu empresa. Escribe la cifra.",
  fallo: "No pudimos leer tu archivo automáticamente. Escribe la cifra.",
  sin_lectura: "Escribe la cifra que respalda este archivo.",
};

export async function estadoDeLectura(
  db: Db,
  solicitud: { id: string; unidad_esperada: string | null },
  evidencia: { id: string; nombre_original: string }
): Promise<EstadoLectura> {
  const base = { evidenciaId: evidencia.id, bloque: null, segundos: null };
  const con = (fase: FaseLectura, extra: Partial<EstadoLectura> = {}): EstadoLectura => ({ ...base, fase, linea: LINEAS[fase] ?? null, ...extra });

  if ((await evidenciasConCifra(db, [evidencia.id])).has(evidencia.id)) return con("con_cifra");

  const { data: lectura } = await db.from("evidencias_contenido").select("estado, mensaje, created_at").eq("evidencia_id", evidencia.id).maybeSingle();
  if (!lectura) return con("sin_lectura");
  const segundos = Math.max(0, Math.round((Date.now() - new Date(lectura.created_at).getTime()) / 1000));

  if (lectura.estado === "omitido") return con(/apagada/i.test(lectura.mensaje ?? "") ? "apagada" : "tope", { segundos });
  if (lectura.estado === "error") return con("fallo", { segundos });
  // Formato que no se lee: su mensaje dice qué hacer (p. ej. guardar un .xls como .xlsx).
  if (lectura.estado === "no_soportado") return con("fallo", { segundos, linea: [lectura.mensaje, "Escribe la cifra."].filter(Boolean).join(" ") });

  if (lectura.estado === "extraido") {
    const bloque = await cargarSugerencia(db, solicitud, evidencia);
    const s = bloque.sugerencia;
    if (s?.estado === "sugerida" && s.principal) return con("sugerida", { segundos, bloque });
    const sinHallazgo = lineaSinHallazgo(solicitud.unidad_esperada);
    if (s?.estado === "sugerida") return con("sin_hallazgo", { segundos, bloque, linea: sinHallazgo });
    // Con parciales de referencia, la línea aprobada (sin el motivo del modelo); si no, qué trae el archivo.
    if (s?.estado === "sin_hallazgo" && s.candidatos.length) return con("sin_hallazgo", { segundos, bloque, linea: LINEA_SIN_TOTAL });
    if (s?.estado === "sin_hallazgo") return con("sin_hallazgo", { segundos, bloque, linea: [sinHallazgo, s.motivo].filter(Boolean).join(" ") });
    if (s?.estado === "rechazada") return con("rechazada", { segundos });
    const { count: fallidas } = await db.from("sugerencias_captura").select("id", { count: "exact", head: true }).eq("evidencia_id", evidencia.id).eq("estado", "fallida");
    if ((fallidas ?? 0) > 0) return con("fallo", { segundos });
  }
  // Pendiente, en proceso, o leída con la sugerencia en camino.
  return segundos > ESPERA_MAX_S ? con("tarda", { segundos }) : con("leyendo", { segundos });
}
