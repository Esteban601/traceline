import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import type { Rol } from "@/lib/roles";
import { BitacoraView, type BitacoraFila, type TenantOpc } from "./bitacora-view";

export const metadata: Metadata = { title: "Bitácora" };

const LIMITE = 500;

export default async function BitacoraPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  // RLS ya acota la bitácora: el staff ve todo, el administrador del cliente solo
  // los eventos de SU tenant. Lo que cambia aquí es el encabezado y el filtro de
  // cliente (que para él no tiene sentido).
  const soyStaff = esStaff(perfil);

  const db = await createClient();

  const [{ data: rows }, { data: tenants }] = await Promise.all([
    db
      .from("bitacora")
      .select(
        "id, created_at, accion, entidad, entidad_id, detalle, tenant_id, usuario:perfiles_usuario!bitacora_usuario_id_fkey(nombre, rol, tenant_id)"
      )
      .order("created_at", { ascending: false })
      .limit(LIMITE),
    db.from("tenants").select("id, nombre").order("nombre", { ascending: true }),
  ]);

  const nombreTenant = new Map(
    ((tenants ?? []) as { id: string; nombre: string }[]).map((t) => [t.id, t.nombre])
  );

  const filas: BitacoraFila[] = (
    (rows ?? []) as unknown as {
      id: string;
      created_at: string;
      accion: string;
      entidad: string;
      entidad_id: string | null;
      detalle: Record<string, unknown> | null;
      tenant_id: string | null;
      usuario: { nombre: string; rol: Rol; tenant_id: string | null } | null;
    }[]
  ).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    accion: r.accion,
    entidad: r.entidad,
    entidadId: r.entidad_id,
    detalle: r.detalle,
    tenantId: r.tenant_id,
    tenantNombre: r.tenant_id ? nombreTenant.get(r.tenant_id) ?? "—" : null,
    usuario: r.usuario?.nombre ?? null,
    // El ROL del actor es parte del registro: un acto del administrador del
    // cliente y uno del staff no se pueden leer como del mismo lado.
    usuarioRol: r.usuario?.rol ?? null,
    usuarioTenantId: r.usuario?.tenant_id ?? null,
  }));

  const tenantsOpc: TenantOpc[] = ((tenants ?? []) as { id: string; nombre: string }[]).map(
    (t) => ({ id: t.id, nombre: t.nombre })
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          {soyStaff ? "Panel interno IRStrat · Trazabilidad" : "Tu panel · Trazabilidad"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Bitácora
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {soyStaff
            ? `Registro de auditoría de todo el sistema. Últimos ${LIMITE} eventos; filtra por cliente, entidad y rango de fechas.`
            : `Registro de auditoría de tu organización. Últimos ${LIMITE} eventos; filtra por entidad y rango de fechas.`}
        </p>
      </header>

      <BitacoraView filas={filas} tenants={tenantsOpc} soyStaff={soyStaff} />
    </div>
  );
}
