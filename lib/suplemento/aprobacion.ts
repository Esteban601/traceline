// =============================================================================
// QUÉ IMPIDE APROBAR UN DOCUMENTO DEL SUPLEMENTO (§7.5; hallazgo del Paso 4 de
// suplemento-calidad).
//
// Lo usan la acción del servidor (la barrera) y la pantalla (para decirlo antes
// de que alguien lo intente), así que dicen lo mismo. Un bloque SELECCIONADO —no
// `no_aplica` ni `no_seleccionado`— bloquea la aprobación si:
//   · no tiene texto terminado: en cola, generándose, con error, esperando un
//     adjunto, o sin texto por cualquier otro camino;
//   · lleva pendientes (los `[Pendiente: …]`; las notas al revisor no cuentan).
// Antes, un bloque `en_cola` no contaba: un documento a medio generar se podía
// aprobar y el Word salía sin esos bloques.
// =============================================================================

export type BloqueParaAprobar = {
  numero: number;
  estado: string;
  texto: string | null;
  /** Solo los pendientes de verdad, sin las notas al revisor. */
  pendientes: number;
};

export type Bloqueante = { numero: number; motivo: string };

const SIN_TERMINAR: Record<string, string> = {
  en_cola: "en cola",
  generando: "generándose",
  error: "con error",
  pendiente_adjunto: "espera su documento adjunto",
};

export function bloqueantesDeAprobacion(bloques: BloqueParaAprobar[]): Bloqueante[] {
  const out: Bloqueante[] = [];
  for (const b of bloques) {
    if (b.estado === "no_aplica" || b.estado === "no_seleccionado") continue;
    const sinTerminar = SIN_TERMINAR[b.estado] ?? (!(b.texto ?? "").trim() ? "sin texto" : null);
    if (sinTerminar) out.push({ numero: b.numero, motivo: sinTerminar });
    else if (b.pendientes > 0) out.push({ numero: b.numero, motivo: `${b.pendientes} pendiente(s)` });
  }
  return out.sort((a, b) => a.numero - b.numero);
}

/** «No se puede aprobar: 2 en cola (5, 9); 1 con 1 pendiente(s) (21).» */
export function motivoDeRechazo(bs: Bloqueante[]): string {
  const grupos = new Map<string, number[]>();
  for (const b of bs) {
    const clave = /pendiente/.test(b.motivo) ? "con pendientes" : b.motivo;
    grupos.set(clave, [...(grupos.get(clave) ?? []), b.numero]);
  }
  return `No se puede aprobar: ${[...grupos].map(([m, ns]) => `${ns.length} ${m} (${ns.join(", ")})`).join("; ")}.`;
}
