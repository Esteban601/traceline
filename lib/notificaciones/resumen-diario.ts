import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logCorreo } from "@/lib/bitacora";
import {
  entregar,
  modoConsola,
  noEntregable,
  plantillaResumenDiario,
  plantillaResumenStaff,
  type ItemResumen,
  type ResultadoEnvio,
  type SeccionResumen,
} from "@/lib/email";
import { fmtDiaLargo, hoyOperacion } from "@/lib/fechas";
import { puedeEntrarPanel, type IdentidadRol } from "@/lib/roles";
import { detalleAviso } from "./inmediatos";

// =============================================================================
// RESUMEN DIARIO (encargo 2026-10-06-sistema-de-alertas, Paso 2).
//
// Sustituye al digest de pendientes. UN correo por persona con todos sus roles,
// en secciones:
//
//   pendientes        — solicitudes a su nombre por entregar   ┐ máximo uno cada
//   observaciones     — solicitudes a su nombre con observación ┘ 5 días (como antes)
//   validadas_ayer    — validadas ayer: al responsable y al jefe del área
//   vb_pendiente      — evidencia recibida sin visto bueno: al jefe del área
//   evidencias        — evidencia por validar: al validador según el origen
//                       (`cliente` → admin del cliente; `irstrat` → staff)
//   sugerencias       — captura sugerida por decidir: ítems a los usuarios y al
//                       jefe del área; al admin del cliente, una línea por área
//
// NOVEDAD. Las cuatro secciones nuevas salen solo cuando algo suyo cambió AYER
// (día de México): una validación de ayer, una evidencia que llegó ayer, una
// sugerencia generada ayer. Cuando salen, listan todo lo pendiente de esa clase,
// con lo nuevo marcado: el correo dice qué cambió sin esconder lo que ya
// esperaba. Una sección vacía no se pinta; un resumen sin secciones no se manda.
//
// EL STAFF recibe un solo correo combinado, con secciones por emisora, y solo de
// emisoras reales (`es_demo = false`, decisión 3 del Paso 0).
//
// NUNCA a: usuarios con `recibe_resumen_diario` apagado (no se registra: es su
// decisión, no un intento), auditores (no son destinatarios de ninguna sección)
// ni emisoras desactivadas. A inactivos y direcciones reservadas: se omite y se
// registra, con el criterio de los avisos inmediatos.
//
// BITÁCORA: acción `resumen_diario`, una fila por destinatario con su id (nunca
// su dirección), la fecha evaluada, el conteo por sección y el modo.
// IDEMPOTENTE POR DÍA: quien ya tiene un resumen enviado u omitido para la fecha
// no recibe otro si el cron corre de más; un fallo sí se reintenta.
// =============================================================================

type Db = SupabaseClient<Database>;

export const DIAS_ANTISPAM = 5;

const ESTADOS_POR_VALIDAR = ["recibido", "en_revision"] as const;

type Perfil = {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  rol: string;
  tenant_id: string | null;
  area: string | null;
  recibe_resumen_diario: boolean;
};

type Sol = {
  id: string;
  titulo: string;
  estado: string;
  fecha_limite: string | null;
  area_asignada: string | null;
  responsable_cliente_id: string | null;
  origen: "irstrat" | "cliente";
  vb_area_por: string | null;
  tenantId: string;
};

export type ResumenDiario = {
  modo: "resend" | "consola";
  fecha: string;
  /** Personas con algo que decirles hoy (antes de omitir o enviar). */
  responsables: number;
  enviados: number;
  /** Personas cuyo único contenido eran pendientes bloqueados por la regla de 5 días. */
  omitidos: number;
  /** Destinatarios que no reciben correo (inactivos o dirección reservada). */
  omitidosDominio: number;
  fallidos: number;
  /** Personas con el resumen apagado que tenían contenido. */
  apagados: number;
  /** Ya tenían su resumen de la fecha. */
  yaEnviados: number;
  detalles: { destinatarioId: string; secciones: Record<string, number>; resultado: string }[];
};

// -----------------------------------------------------------------------------
// Fechas: México no tiene horario de verano desde 2022 (UTC−6 todo el año).
// -----------------------------------------------------------------------------
function inicioDiaMx(iso: string): string {
  return new Date(`${iso}T06:00:00.000Z`).toISOString();
}
function diaAnterior(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function todas<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const fuera: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) throw new Error(error.message);
    fuera.push(...(data ?? []));
    if ((data ?? []).length < 1000) return fuera;
  }
}

/**
 * ¿Esta fila de bitácora es un correo que SALIÓ? Condición explícita sobre el
 * modo (decisión del Paso 0): las filas nuevas dicen `modo = enviado`; las
 * anteriores al encargo decían el transporte en `modo` y el resultado en
 * `enviado`, y las más viejas no traían `enviado` y sí eran envíos.
 */
export function fueEnviado(d: { modo?: string; enviado?: boolean } | null | undefined): boolean {
  if (!d) return false;
  if (d.modo === "enviado") return true;
  if (d.modo === "omitido" || d.modo === "fallido") return false;
  return d.enviado !== false;
}

function nota(s: Sol, extra?: string | null): string {
  const partes = [s.fecha_limite ? `Vence el ${fmtDiaLargo(s.fecha_limite)}` : null, extra ?? null].filter(Boolean);
  return partes.join(" · ");
}

export async function procesarResumenDiario(db: Db, fecha?: string): Promise<ResumenDiario> {
  const hoy = fecha ?? hoyOperacion();
  const ayer = diaAnterior(hoy);
  const desdeAyer = inicioDiaMx(ayer);
  const hastaHoy = inicioDiaMx(hoy);
  const resumen: ResumenDiario = {
    modo: modoConsola() ? "consola" : "resend",
    fecha: hoy,
    responsables: 0,
    enviados: 0,
    omitidos: 0,
    omitidosDominio: 0,
    fallidos: 0,
    apagados: 0,
    yaEnviados: 0,
    detalles: [],
  };

  // ── Datos ───────────────────────────────────────────────────────────────────
  const { data: tenants } = await db.from("tenants").select("id, nombre, es_demo, activo");
  const tenant = new Map((tenants ?? []).filter((t) => t.activo).map((t) => [t.id, t]));

  const perfiles = (await todas<Perfil>((a, b) =>
    db.from("perfiles_usuario").select("id, nombre, email, activo, rol, tenant_id, area, recibe_resumen_diario").range(a, b)
  )) as Perfil[];

  type SolRow = Omit<Sol, "tenantId"> & { reporte: { tenant_id: string; estado: string } | null };
  const solsCrudas = await todas<SolRow>((a, b) =>
    db
      .from("solicitudes")
      .select(
        "id, titulo, estado, fecha_limite, area_asignada, responsable_cliente_id, origen, vb_area_por, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id, estado)"
      )
      .eq("declinada", false)
      .eq("desactivada", false)
      .range(a, b) as unknown as PromiseLike<{ data: SolRow[] | null; error: { message: string } | null }>
  );
  const sols: Sol[] = solsCrudas
    .filter((s) => s.reporte && s.reporte.estado !== "congelado" && tenant.has(s.reporte.tenant_id))
    .map((s) => ({ ...s, tenantId: s.reporte!.tenant_id }));
  const solPorId = new Map(sols.map((s) => [s.id, s]));

  // Validadas ayer (la bitácora del trigger de estado).
  const validadasAyer = new Set(
    (
      await todas<{ entidad_id: string | null }>((a, b) =>
        db
          .from("bitacora")
          .select("entidad_id")
          .eq("accion", "cambio_estado")
          .eq("detalle->>estado_nuevo", "validado")
          .gte("created_at", desdeAyer)
          .lt("created_at", hastaHoy)
          .range(a, b)
      )
    )
      .map((r) => r.entidad_id)
      .filter((x): x is string => !!x && solPorId.get(x)?.estado === "validado")
  );

  // Evidencias que llegaron ayer: la fila `evidencia_creada` que escribe el
  // trigger de la carga (trae `solicitud_id`). Se lee de la bitácora y no de
  // `evidencias`: es el registro del hecho, y no depende de los permisos de
  // service_role sobre la tabla, que en el stack local no la lee (§10, deuda).
  const evidenciaAyer = new Set(
    (
      await todas<{ detalle: unknown }>((a, b) =>
        db
          .from("bitacora")
          .select("detalle")
          .eq("accion", "evidencia_creada")
          .gte("created_at", desdeAyer)
          .lt("created_at", hastaHoy)
          .range(a, b)
      )
    )
      .map((r) => (r.detalle as { solicitud_id?: string } | null)?.solicitud_id)
      .filter((x): x is string => !!x)
  );

  // Sugerencias por decidir, y cuáles nacieron ayer.
  const sugeridas = await todas<{ solicitud_id: string; created_at: string }>((a, b) =>
    db.from("sugerencias_captura").select("solicitud_id, created_at").eq("estado", "sugerida").range(a, b)
  );
  const sugPorSol = new Map<string, { total: number; nuevas: number }>();
  for (const s of sugeridas) {
    if (!solPorId.has(s.solicitud_id)) continue;
    const c = sugPorSol.get(s.solicitud_id) ?? { total: 0, nuevas: 0 };
    c.total += 1;
    if (s.created_at >= desdeAyer && s.created_at < hastaHoy) c.nuevas += 1;
    sugPorSol.set(s.solicitud_id, c);
  }

  // Bloqueo de 5 días (solo pendientes y observaciones) e idempotencia del día.
  const corte = new Date(Date.now() - DIAS_ANTISPAM * 24 * 60 * 60 * 1000).toISOString();
  const recientes = await todas<{ accion: string; detalle: unknown }>((a, b) =>
    db
      .from("bitacora")
      .select("accion, detalle")
      .in("accion", ["recordatorio_enviado", "recordatorio_programado_enviado", "resumen_diario"])
      .gte("created_at", corte)
      .range(a, b)
  );
  const bloqueados = new Set<string>();
  const yaDeHoy = new Set<string>();
  for (const r of recientes) {
    const d = (r.detalle ?? {}) as { responsable_id?: string; destinatario_id?: string; fecha?: string; incluye_pendientes?: boolean; modo?: string; enviado?: boolean };
    const quien = d.destinatario_id ?? d.responsable_id;
    if (!quien) continue;
    if (r.accion === "resumen_diario") {
      if (d.fecha === hoy && d.modo !== "fallido") yaDeHoy.add(quien);
      if (d.incluye_pendientes && fueEnviado(d)) bloqueados.add(quien);
    } else if (fueEnviado(d)) {
      bloqueados.add(quien);
    }
  }

  // ── Secciones por persona ───────────────────────────────────────────────────
  const delTenant = (tid: string) => perfiles.filter((p) => p.tenant_id === tid);
  const secciones = new Map<string, Map<string, ItemResumen[]>>();
  const agregar = (personaId: string, clave: string, item: ItemResumen) => {
    const m = secciones.get(personaId) ?? new Map<string, ItemResumen[]>();
    m.set(clave, [...(m.get(clave) ?? []), item]);
    secciones.set(personaId, m);
  };
  const enPanel = (p: Perfil) => puedeEntrarPanel(p as unknown as IdentidadRol);
  const ruta = (p: Perfil, s: Sol) => (enPanel(p) ? `/admin/solicitudes/${s.id}` : `/portal/solicitudes/${s.id}`);
  const perfilPorId = new Map(perfiles.map((p) => [p.id, p]));
  const jefesDe = (tid: string, area: string | null) =>
    area ? delTenant(tid).filter((p) => p.rol === "jefe_area" && p.area === area) : [];
  const usuariosDe = (tid: string, area: string | null) =>
    area ? delTenant(tid).filter((p) => (p.rol === "cliente" || p.rol === "jefe_area") && p.area === area) : [];
  const adminsDe = (tid: string) => delTenant(tid).filter((p) => p.rol === "admin_cliente");
  const staff = perfiles.filter((p) => p.tenant_id === null && p.rol !== "auditor");

  // Pendientes y observaciones: al responsable (el digest de siempre).
  for (const s of sols) {
    if (!s.responsable_cliente_id) continue;
    const p = perfilPorId.get(s.responsable_cliente_id);
    if (!p) continue;
    if (s.estado === "solicitado") agregar(p.id, "pendientes", { titulo: s.titulo, nota: nota(s), ruta: ruta(p, s) });
    if (s.estado === "observaciones") agregar(p.id, "observaciones", { titulo: s.titulo, nota: nota(s, "Tiene una observación por atender"), ruta: ruta(p, s), destacado: true });
  }

  // Validadas ayer: responsable y jefe del área.
  for (const id of validadasAyer) {
    const s = solPorId.get(id)!;
    const a = [
      ...(s.responsable_cliente_id && perfilPorId.get(s.responsable_cliente_id) ? [perfilPorId.get(s.responsable_cliente_id)!] : []),
      ...jefesDe(s.tenantId, s.area_asignada),
    ];
    for (const p of new Map(a.map((x) => [x.id, x])).values()) {
      agregar(p.id, "validadas_ayer", { titulo: s.titulo, nota: s.area_asignada ? `Área: ${s.area_asignada}` : null, ruta: ruta(p, s) });
    }
  }

  // Visto bueno pendiente: al jefe, si en su área llegó evidencia ayer.
  const vbPorJefe = new Map<string, { items: ItemResumen[]; nuevo: boolean }>();
  for (const s of sols) {
    if (!ESTADOS_POR_VALIDAR.includes(s.estado as never) || s.vb_area_por) continue;
    for (const j of jefesDe(s.tenantId, s.area_asignada)) {
      const e = vbPorJefe.get(j.id) ?? { items: [], nuevo: false };
      const nueva = evidenciaAyer.has(s.id);
      e.items.push({ titulo: s.titulo, nota: nueva ? "Evidencia nueva desde ayer" : "Espera tu visto bueno", ruta: ruta(j, s), destacado: nueva });
      e.nuevo ||= nueva;
      vbPorJefe.set(j.id, e);
    }
  }
  for (const [id, e] of vbPorJefe) if (e.nuevo) for (const it of e.items) agregar(id, "vb_pendiente", it);

  // Evidencias por validar. Origen `cliente` → admins del cliente (aquí); origen
  // `irstrat` → staff (más abajo, en su correo combinado).
  const porValidarCliente = new Map<string, { items: ItemResumen[]; nuevo: boolean }>();
  const porValidarStaff = new Map<string, { items: ItemResumen[]; nuevo: boolean }>(); // por tenant
  for (const s of sols) {
    if (!ESTADOS_POR_VALIDAR.includes(s.estado as never)) continue;
    const nueva = evidenciaAyer.has(s.id);
    const notaItem = [s.area_asignada ? `Área: ${s.area_asignada}` : null, nueva ? "Evidencia nueva desde ayer" : null].filter(Boolean).join(" · ") || null;
    const item = (p: Perfil): ItemResumen => ({ titulo: s.titulo, nota: notaItem, ruta: ruta(p, s), destacado: nueva });
    if (s.origen === "cliente") {
      for (const a of adminsDe(s.tenantId)) {
        const e = porValidarCliente.get(a.id) ?? { items: [], nuevo: false };
        e.items.push(item(a));
        e.nuevo ||= nueva;
        porValidarCliente.set(a.id, e);
      }
    } else if (!tenant.get(s.tenantId)?.es_demo) {
      const e = porValidarStaff.get(s.tenantId) ?? { items: [], nuevo: false };
      e.items.push({ titulo: s.titulo, nota: notaItem, ruta: `/admin/solicitudes/${s.id}`, destacado: nueva });
      e.nuevo ||= nueva;
      porValidarStaff.set(s.tenantId, e);
    }
  }
  for (const [id, e] of porValidarCliente) if (e.nuevo) for (const it of e.items) agregar(id, "evidencias", it);

  // Sugerencias por decidir: ítems a usuarios y jefe del área; conteo por área al admin.
  const sugPorPersona = new Map<string, { items: ItemResumen[]; nuevo: boolean }>();
  const sugPorAdmin = new Map<string, { porArea: Map<string, number>; nuevo: boolean }>();
  for (const [solId, c] of sugPorSol) {
    const s = solPorId.get(solId)!;
    const nueva = c.nuevas > 0;
    for (const p of usuariosDe(s.tenantId, s.area_asignada)) {
      const e = sugPorPersona.get(p.id) ?? { items: [], nuevo: false };
      e.items.push({ titulo: s.titulo, nota: `${c.total} ${c.total === 1 ? "cifra sugerida" : "cifras sugeridas"} por confirmar${nueva ? " · nueva desde ayer" : ""}`, ruta: ruta(p, s), destacado: nueva });
      e.nuevo ||= nueva;
      sugPorPersona.set(p.id, e);
    }
    for (const a of adminsDe(s.tenantId)) {
      const e = sugPorAdmin.get(a.id) ?? { porArea: new Map<string, number>(), nuevo: false };
      const area = s.area_asignada ?? "Sin área";
      e.porArea.set(area, (e.porArea.get(area) ?? 0) + c.total);
      e.nuevo ||= nueva;
      sugPorAdmin.set(a.id, e);
    }
  }
  for (const [id, e] of sugPorPersona) if (e.nuevo) for (const it of e.items) agregar(id, "sugerencias", it);
  for (const [id, e] of sugPorAdmin) {
    if (!e.nuevo) continue;
    for (const [area, n] of e.porArea) agregar(id, "sugerencias", { titulo: `${area}: ${n} ${n === 1 ? "sugerencia" : "sugerencias"} por decidir`, nota: null, ruta: null });
  }

  // ── Envío: clientes ─────────────────────────────────────────────────────────
  const TITULOS: Record<string, { titulo: string; intro: string }> = {
    pendientes: { titulo: "Pendientes de entrega", intro: "Solicitudes a tu nombre que esperan evidencia." },
    observaciones: { titulo: "Observaciones por atender", intro: "Solicitudes que alguien observó y esperan tu corrección." },
    validadas_ayer: { titulo: "Validadas ayer", intro: "Solicitudes de tu responsabilidad o de tu área que quedaron validadas." },
    vb_pendiente: { titulo: "Visto bueno pendiente", intro: "Evidencia de tu área que espera tu visto bueno." },
    evidencias: { titulo: "Evidencias por validar", intro: "Entregas que esperan tu validación." },
    sugerencias: { titulo: "Sugerencias de captura por decidir", intro: "Cifras que la plataforma leyó de una evidencia y esperan confirmación." },
  };
  const ORDEN = ["observaciones", "pendientes", "validadas_ayer", "vb_pendiente", "evidencias", "sugerencias"];

  for (const [personaId, m] of secciones) {
    const p = perfilPorId.get(personaId);
    if (!p || p.tenant_id === null || p.rol === "auditor") continue;
    const t = tenant.get(p.tenant_id);
    if (!t) continue;
    resumen.responsables += 1;
    if (!p.recibe_resumen_diario) { resumen.apagados += 1; continue; }
    if (yaDeHoy.has(p.id)) { resumen.yaEnviados += 1; continue; }
    const bloqueado = bloqueados.has(p.id);
    const secs: SeccionResumen[] = ORDEN.filter((k) => m.has(k) && !(bloqueado && (k === "pendientes" || k === "observaciones"))).map((k) => ({ clave: k, ...TITULOS[k], items: m.get(k)! }));
    if (secs.length === 0) { resumen.omitidos += 1; continue; }
    await enviarYRegistrar(db, resumen, {
      p,
      tenantId: p.tenant_id,
      hoy,
      secs,
      plantilla: () => plantillaResumenDiario(p.nombre, { emisora: t.nombre, secciones: secs, rutaInicio: enPanel(p) ? "/admin" : "/portal" }),
    });
  }

  // ── Envío: staff (un correo combinado, solo emisoras reales) ───────────────
  const emisorasStaff = [...porValidarStaff.entries()]
    .filter(([, e]) => e.nuevo)
    .map(([tid, e]) => ({ nombre: tenant.get(tid)!.nombre, secciones: [{ clave: "evidencias", ...TITULOS.evidencias, items: e.items }] }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  if (emisorasStaff.length > 0) {
    for (const p of staff) {
      resumen.responsables += 1;
      if (!p.recibe_resumen_diario) { resumen.apagados += 1; continue; }
      if (yaDeHoy.has(p.id)) { resumen.yaEnviados += 1; continue; }
      await enviarYRegistrar(db, resumen, {
        p,
        tenantId: null,
        hoy,
        secs: emisorasStaff.flatMap((e) => e.secciones),
        emisoras: emisorasStaff.length,
        plantilla: () => plantillaResumenStaff(p.nombre, { emisoras: emisorasStaff }),
      });
    }
  }

  return resumen;
}

async function enviarYRegistrar(
  db: Db,
  resumen: ResumenDiario,
  o: { p: Perfil; tenantId: string | null; hoy: string; secs: SeccionResumen[]; emisoras?: number; plantilla: () => ReturnType<typeof plantillaResumenDiario> }
) {
  const omitir = !o.p.activo ? "usuario inactivo" : noEntregable(o.p.email);
  let r: ResultadoEnvio;
  try {
    r = await entregar(o.p.email, o.plantilla(), { omitir });
  } catch (e) {
    r = { ok: false, modo: "resend", error: e instanceof Error ? e.message : "error al armar el correo" };
  }
  const conteo: Record<string, number> = {};
  for (const s of o.secs) conteo[s.clave] = (conteo[s.clave] ?? 0) + s.items.length;
  const base = detalleAviso(o.p.id, { tipo: "resumen_diario", id: o.hoy }, r);
  await logCorreo(db, {
    tenantId: o.tenantId,
    usuarioId: null,
    accion: "resumen_diario",
    entidadId: null,
    detalle: {
      ...base,
      fecha: o.hoy,
      secciones: conteo,
      incluye_pendientes: "pendientes" in conteo || "observaciones" in conteo,
      ...(o.emisoras ? { emisoras: o.emisoras } : {}),
    },
  });
  if (r.modo === "omitido") resumen.omitidosDominio += 1;
  else if (r.ok) resumen.enviados += 1;
  else resumen.fallidos += 1;
  resumen.detalles.push({ destinatarioId: o.p.id, secciones: conteo, resultado: r.modo === "omitido" ? "omitido" : r.ok ? "enviado" : "fallido" });
}
