import type { Tono } from "@/lib/estados";
import { ESTADO_META, type EstadoSolicitud } from "@/lib/estados";

// =============================================================================
// Presentación de la bitácora (timeline de solicitud y vista global). Mapea cada
// acción a una etiqueta legible y un tono, y arma un resumen a partir del detalle.
// La bitácora es la fuente de verdad; aquí solo se le da forma editorial.
// =============================================================================

export const ACCION_META: Record<string, { label: string; tono: Tono }> = {
  evidencia_creada: { label: "Evidencia cargada", tono: "azul" },
  captura_creada: { label: "Valor capturado", tono: "azul" },
  cambio_estado: { label: "Cambio de estado", tono: "ambar-fuerte" },
  solicitud_enviada: { label: "Solicitud enviada", tono: "ambar-fuerte" },
  recordatorio_enviado: { label: "Recordatorio enviado", tono: "ambar" },
  aviso_observacion: { label: "Observación notificada", tono: "rojo" },
  solicitud_creada: { label: "Solicitud creada", tono: "verde" },
  solicitud_editada: { label: "Solicitud editada", tono: "gris" },
  solicitud_eliminada: { label: "Solicitud eliminada", tono: "rojo" },
  usuario_creado: { label: "Usuario creado", tono: "verde" },
  usuario_desactivado: { label: "Usuario desactivado", tono: "rojo" },
  usuario_reactivado: { label: "Usuario reactivado", tono: "verde" },
  plantilla_creada: { label: "Plantilla creada", tono: "verde" },
  reporte_creado_desde_plantilla: { label: "Reporte creado", tono: "verde" },
  reporte_congelado: { label: "Reporte congelado", tono: "gris" },
  registro_creado: { label: "Registro de clima creado", tono: "verde" },
  registro_editado: { label: "Registro de clima editado", tono: "gris" },
  registro_desactivado: { label: "Registro de clima desactivado", tono: "rojo" },
  registro_reactivado: { label: "Registro de clima reactivado", tono: "verde" },
  registro_valores_capturados: { label: "Valores de clima capturados", tono: "azul" },
  objetivo_creado: { label: "Objetivo creado", tono: "verde" },
  objetivo_editado: { label: "Objetivo editado", tono: "gris" },
  objetivo_desactivado: { label: "Objetivo desactivado", tono: "rojo" },
  objetivo_reactivado: { label: "Objetivo reactivado", tono: "verde" },
  cuestionario_respondido: { label: "Cuestionario respondido", tono: "azul" },
  tenant_creado: { label: "Cliente dado de alta", tono: "verde" },
  tenant_desactivado: { label: "Cliente desactivado", tono: "rojo" },
  tenant_reactivado: { label: "Cliente reactivado", tono: "verde" },
  tenant_logo_actualizado: { label: "Logo actualizado", tono: "gris" },
  tenant_logo_eliminado: { label: "Logo eliminado", tono: "gris" },
  invitacion_creada: { label: "Invitación generada", tono: "ambar" },
  invitacion_usada: { label: "Invitación canjeada", tono: "verde" },
};

export function accionMeta(accion: string): { label: string; tono: Tono } {
  return ACCION_META[accion] ?? { label: accion, tono: "gris" };
}

/** Entidades reales de la bitácora, para el filtro de la vista global. */
export const ENTIDADES: { value: string; label: string }[] = [
  { value: "solicitudes", label: "Solicitudes" },
  { value: "evidencias", label: "Evidencias" },
  { value: "capturas_valor", label: "Capturas de valor" },
  { value: "correo", label: "Correos" },
  { value: "perfiles_usuario", label: "Usuarios" },
  { value: "plantillas", label: "Plantillas" },
  { value: "reportes", label: "Reportes" },
  { value: "registros_clima", label: "Registros de clima" },
  { value: "objetivos", label: "Objetivos" },
  { value: "tenants", label: "Clientes" },
  { value: "invitaciones", label: "Invitaciones" },
];

type Detalle = Record<string, unknown> | null;

function s(detalle: Detalle, k: string): string | null {
  const v = detalle?.[k];
  return typeof v === "string" ? v : null;
}
function n(detalle: Detalle, k: string): number | null {
  const v = detalle?.[k];
  return typeof v === "number" ? v : null;
}
function limpiar(v: string | null): string | null {
  return v ? v.replace(/\[DEMO\]\s*/i, "").trim() : null;
}

const estadoLabel = (e: string | null): string =>
  e && e in ESTADO_META ? ESTADO_META[e as EstadoSolicitud].label : (e ?? "—");

/** Resumen legible de una entrada de bitácora a partir de su detalle. */
export function resumenBitacora(accion: string, detalle: Detalle): string {
  switch (accion) {
    case "cambio_estado":
      return `${estadoLabel(s(detalle, "estado_anterior"))} → ${estadoLabel(
        s(detalle, "estado_nuevo")
      )}`;
    case "evidencia_creada": {
      const v = n(detalle, "version");
      const nombre = s(detalle, "nombre_original");
      return [v != null ? `v${v}` : null, nombre].filter(Boolean).join(" · ") || "Nueva versión";
    }
    case "captura_creada": {
      const valor = n(detalle, "valor");
      const unidad = s(detalle, "unidad");
      return valor != null ? `${valor}${unidad ? ` ${unidad}` : ""}` : "Valor capturado";
    }
    case "solicitud_enviada": {
      const total = n(detalle, "total");
      const nombre = limpiar(s(detalle, "nombre"));
      return [nombre, total ? `${total} solicitud(es)` : null].filter(Boolean).join(" · ");
    }
    case "recordatorio_enviado":
    case "aviso_observacion":
      return limpiar(s(detalle, "nombre")) ?? "Notificación por correo";
    case "solicitud_creada":
    case "solicitud_editada":
    case "solicitud_eliminada":
      return limpiar(s(detalle, "titulo")) ?? "";
    case "usuario_creado":
    case "usuario_desactivado":
    case "usuario_reactivado":
      return limpiar(s(detalle, "nombre")) ?? "";
    case "plantilla_creada": {
      const nombre = s(detalle, "nombre");
      const c = n(detalle, "solicitudes");
      return [nombre, c != null ? `${c} solicitudes` : null].filter(Boolean).join(" · ");
    }
    case "reporte_creado_desde_plantilla":
      return s(detalle, "nombre") ?? "";
    case "reporte_congelado":
      return s(detalle, "nombre") ?? "";
    case "registro_creado":
    case "registro_editado":
    case "registro_desactivado":
    case "registro_reactivado":
      return limpiar(s(detalle, "nombre")) ?? "";
    case "registro_valores_capturados": {
      const ej = n(detalle, "ejercicio");
      return limpiar(s(detalle, "nombre")) ?? (ej != null ? `Ejercicio ${ej}` : "");
    }
    case "objetivo_creado":
    case "objetivo_editado":
    case "objetivo_desactivado":
    case "objetivo_reactivado":
      return limpiar(s(detalle, "nombre")) ?? "";
    case "tenant_creado": {
      const nombre = limpiar(s(detalle, "nombre"));
      const prefijo = s(detalle, "prefijo_folio");
      return [nombre, prefijo].filter(Boolean).join(" · ");
    }
    case "tenant_desactivado":
    case "tenant_reactivado":
    case "tenant_logo_actualizado":
    case "tenant_logo_eliminado":
      return limpiar(s(detalle, "nombre")) ?? "";
    case "invitacion_creada":
    case "invitacion_usada":
      return s(detalle, "email") ?? limpiar(s(detalle, "nombre")) ?? "";
    default:
      return "";
  }
}

/** Justificación de ajuste, si la entrada la trae (evidencia/captura). */
export function justificacionDe(detalle: Detalle): string | null {
  return s(detalle, "justificacion");
}
