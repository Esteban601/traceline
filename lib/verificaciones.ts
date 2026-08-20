import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ORIGEN_META, type OrigenSolicitud } from "@/lib/origen";
import { actorBitacora, type Rol } from "@/lib/roles";
import type { EstadoSolicitud } from "@/lib/estados";

// =============================================================================
// LAS DOS VERIFICACIONES de una solicitud, resueltas en un solo lugar.
//
//   1. VISTO BUENO DEL ÁREA — el jefe del área respalda lo que su equipo entregó.
//   2. VALIDACIÓN FINAL     — según el origen: IRStrat, o el administrador del
//                             cliente para las solicitudes internas.
//
// Son independientes: se puede validar sin visto bueno (y entonces la marca dice
// "no se dio"), y un visto bueno no adelanta la validación. El valor de la doble
// verificación está en MOSTRAR LAS DOS, así que se calculan juntas y se pintan
// juntas (components/marcas-verificacion.tsx).
//
// La validación no tiene columnas propias: quién validó y cuándo se leen de la
// bitácora, que es la fuente de verdad de los actos. Es a propósito — inventar
// `validado_por`/`validado_fecha` habría creado un segundo registro del mismo
// hecho, con el riesgo de que discrepen.
// =============================================================================

export type MarcaVB = {
  firmado: boolean;
  /** Nombre del jefe que firmó, ya con su rol («Ana · Jefe de área»). */
  quien: string | null;
  fecha: string | null;
};

export type MarcaValidacion = {
  validado: boolean;
  /** «Validación IRStrat» o «Validación interna del cliente». */
  etiqueta: string;
  /** Quién la hizo, si la bitácora lo registra (los actos de sistema no tienen autor). */
  quien: string | null;
  fecha: string | null;
  /** Estado actual, para cuando todavía no está validada. */
  estado: EstadoSolicitud;
};

export type Verificaciones = { vb: MarcaVB; validacion: MarcaValidacion };

type SolicitudVerificable = {
  id: string;
  estado: EstadoSolicitud;
  origen: OrigenSolicitud;
  vb_area_por: string | null;
  vb_area_fecha: string | null;
};

/**
 * Resuelve las dos marcas de una solicitud. Usa el cliente de SESIÓN: RLS ya
 * acota lo que cada quien puede leer, así que el portal y el panel comparten
 * exactamente este cálculo.
 */
export async function cargarVerificaciones(
  db: SupabaseClient<Database>,
  sol: SolicitudVerificable
): Promise<Verificaciones> {
  const validado = sol.estado === "validado" || sol.estado === "congelado";

  const [firmante, evento] = await Promise.all([
    sol.vb_area_por
      ? db
          .from("perfiles_usuario")
          .select("nombre, rol, tenant_id")
          .eq("id", sol.vb_area_por)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    validado
      ? db
          .from("bitacora")
          .select(
            "created_at, detalle, usuario:perfiles_usuario!bitacora_usuario_id_fkey(nombre, rol, tenant_id)"
          )
          .eq("accion", "cambio_estado")
          .eq("entidad_id", sol.id)
          .eq("detalle->>estado_nuevo", "validado")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const f = firmante.data as { nombre: string; rol: Rol; tenant_id: string | null } | null;
  const ev = evento.data as {
    created_at: string;
    usuario: { nombre: string; rol: Rol; tenant_id: string | null } | null;
  } | null;

  return {
    vb: {
      firmado: sol.vb_area_por != null,
      quien: f ? actorBitacora(f.nombre, f.rol, f.tenant_id) : null,
      fecha: sol.vb_area_fecha,
    },
    validacion: {
      validado,
      etiqueta: ORIGEN_META[sol.origen].validacion,
      quien: ev?.usuario ? actorBitacora(ev.usuario.nombre, ev.usuario.rol, ev.usuario.tenant_id) : null,
      fecha: ev?.created_at ?? null,
      estado: sol.estado,
    },
  };
}
