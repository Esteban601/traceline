"use client";

import { startTransition, useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { ROL_LABEL, rolRequiereArea, type OpcionRol, type Rol } from "@/lib/roles";
import { AREA_MAX } from "@/lib/tenants";
import { fmtFechaHora } from "@/lib/fechas";
import {
  crearUsuario,
  cambiarActivoUsuario,
  regenerarInvitacion,
  crearArea,
  renombrarArea,
  cambiarActivoArea,
  type AltaUsuarioState,
  type Invitacion,
} from "./actions";

export type UsuarioFila = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  area: string | null;
  activo: boolean;
  tenantId: string;
  tenantNombre: string;
  /** El propio usuario de la sesión: no se ofrece desactivarse a sí mismo. */
  esYo: boolean;
  /** ¿Quien mira puede administrarlo? Si no, la fila es de solo lectura. */
  administrable: boolean;
};
export type TenantOpcion = { id: string; nombre: string };
/** Área del catálogo del cliente, tal como se gestiona en esta pantalla. */
export type AreaFila = { id: string; nombre: string; activo: boolean };

function limpiar(nombre: string): string {
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

const initialAlta: AltaUsuarioState = { ok: false, error: null, creado: null };

const labelCls = "block text-sm font-medium text-ink";
const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60";

export function UsuariosView({
  usuarios,
  tenants,
  areas,
  roles,
  soyStaff = true,
  tenantInicial = null,
  abrirAltaInicial = false,
  tenantAreas = null,
  nombreClienteAreas = null,
  areasGestion = [],
}: {
  usuarios: UsuarioFila[];
  tenants: TenantOpcion[];
  areas: { tenant_id: string; area: string }[];
  /** Roles que ESTE perfil puede asignar (lib/roles.ts). */
  roles: OpcionRol[];
  /** false = administrador del cliente: solo su cliente, y gestiona sus áreas. */
  soyStaff?: boolean;
  /** Cliente preseleccionado (llega del alta como ?tenant=<id>). */
  tenantInicial?: string | null;
  /** ¿Abrir el formulario de alta al entrar? Solo si se llegó con ?tenant=. */
  abrirAltaInicial?: boolean;
  /** Cliente cuyas ÁREAS se gestionan aquí; null = no se muestra la sección. */
  tenantAreas?: string | null;
  nombreClienteAreas?: string | null;
  areasGestion?: AreaFila[];
}) {
  const toast = useToast();
  // Si se llega desde el alta de un cliente, el formulario abre solo: la
  // intención de quien hizo clic ya era dar de alta a alguien.
  const [abrirAlta, setAbrirAlta] = useState(abrirAltaInicial);
  const [state, dispatch, pending] = useActionState(crearUsuario, initialAlta);

  // Formulario controlado.
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState(
    tenantInicial ?? (tenants.length === 1 ? tenants[0].id : "")
  );
  const [rol, setRol] = useState<string>(roles[0]?.value ?? "cliente");
  // ¿El rol elegido lleva área? Misma función que usan la server action y RLS.
  const requiereArea = rolRequiereArea(rol as Rol);
  const [area, setArea] = useState("");

  const [credenciales, setCredenciales] = useState<AltaUsuarioState["creado"]>(null);

  const areasTenant = useMemo(
    () =>
      [...new Set(areas.filter((a) => a.tenant_id === tenantId).map((a) => a.area))].sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [areas, tenantId]
  );

  useEffect(() => {
    if (state.ok && state.creado) {
      setCredenciales(state.creado);
      toast.success("Usuario creado. Comparte la contraseña temporal.");
      // Limpiar el formulario y cerrarlo.
      setNombre("");
      setEmail("");
      setRol(roles[0]?.value ?? "cliente");
      setArea("");
      setAbrirAlta(false);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return toast.error("El nombre es obligatorio.");
    if (!email.trim()) return toast.error("El correo es obligatorio.");
    if (!tenantId) return toast.error("Selecciona el cliente.");
    const fd = new FormData();
    fd.set("nombre", nombre);
    fd.set("email", email);
    fd.set("tenant_id", tenantId);
    fd.set("rol", rol);
    // Los dos roles acotados por área (responsable y jefe) mandan su área; los
    // demás, ninguna. La regla vive en lib/roles.ts, que es la que aplica también
    // la server action: compararla aquí con un literal fue el bug del rol nuevo.
    fd.set("area", requiereArea ? area : "");
    startTransition(() => dispatch(fd));
  };

  // Agrupar usuarios por tenant.
  const grupos = useMemo(() => {
    const m = new Map<string, { nombre: string; filas: UsuarioFila[] }>();
    for (const u of usuarios) {
      if (!m.has(u.tenantId)) m.set(u.tenantId, { nombre: u.tenantNombre, filas: [] });
      m.get(u.tenantId)!.filas.push(u);
    }
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [usuarios]);

  return (
    <div className="space-y-8">
      {/* Credenciales generadas (se muestran una vez) */}
      {credenciales && (
        <CredencialesCard
          creado={credenciales}
          onCerrar={() => setCredenciales(null)}
        />
      )}

      {/* Alta */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">
            Usuarios
            <span className="ml-2 text-sm font-normal text-muted">{usuarios.length}</span>
          </h2>
          <Button size="sm" onClick={() => setAbrirAlta((v) => !v)}>
            {abrirAlta ? "Cerrar" : "Nuevo usuario"}
          </Button>
        </div>

        {abrirAlta && (
          <form
            onSubmit={onSubmit}
            className="space-y-6 rounded-card border border-line bg-surface p-6 shadow-soft"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="u-nombre" className={labelCls}>
                  Nombre
                </label>
                <input
                  id="u-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  placeholder="Nombre y apellido"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="u-email" className={labelCls}>
                  Correo
                </label>
                <input
                  id="u-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="persona@empresa.com"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <label htmlFor="u-tenant" className={labelCls}>
                  Cliente
                </label>
                {tenants.length <= 1 ? (
                  <p className="mt-1.5 rounded-xl border border-line bg-crema/30 px-3.5 py-3 text-sm text-ink">
                    {tenants[0] ? limpiar(tenants[0].nombre) : "Sin clientes"}
                  </p>
                ) : (
                  <select
                    id="u-tenant"
                    value={tenantId}
                    onChange={(e) => {
                      setTenantId(e.target.value);
                      setArea(""); // cada cliente tiene sus propias áreas
                    }}
                    className={inputCls}
                  >
                    <option value="" disabled>
                      Selecciona…
                    </option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {limpiar(t.nombre)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label htmlFor="u-rol" className={labelCls}>
                  Rol
                </label>
                <select
                  id="u-rol"
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  className={inputCls}
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  {roles.find((r) => r.value === rol)?.ayuda ?? ""}
                </p>
              </div>
              <div>
                <label htmlFor="u-area" className={labelCls}>
                  Área{" "}
                  <span className="font-normal text-muted">
                    {requiereArea ? "" : "· no aplica"}
                  </span>
                </label>
                {/* Con catálogo de áreas se elige de la lista: el área debe
                    coincidir EXACTAMENTE con la de las solicitudes (de eso
                    depende qué ve el usuario), y un select no admite erratas.
                    Sin catálogo (clientes heredados) se escribe a mano. */}
                {areasTenant.length > 0 ? (
                  <select
                    id="u-area"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    disabled={!requiereArea}
                    className={inputCls}
                  >
                    <option value="">{requiereArea ? "Selecciona…" : "—"}</option>
                    {areasTenant.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="u-area"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    disabled={!requiereArea}
                    placeholder={requiereArea ? "RH, Operaciones…" : "—"}
                    className={inputCls}
                  />
                )}
              </div>
            </div>

            <p className="rounded-xl border border-dashed border-line bg-crema/30 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
              Se generará una liga de invitación de un solo uso (72 h) para que la
              persona establezca su propia contraseña, más una contraseña temporal
              de respaldo. Ambas se muestran una sola vez. El correo de invitación
              ya está implementado: mientras no haya cuenta de Resend, sale al log
              del servidor y la vía de entrega es la liga que verás aquí.
            </p>

            <div className="flex justify-end gap-2.5 border-t border-line pt-6">
              <button
                type="button"
                onClick={() => setAbrirAlta(false)}
                className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
              >
                Cancelar
              </button>
              <Button type="submit" loading={pending}>
                Crear usuario
              </Button>
            </div>
          </form>
        )}
      </section>

      {/* Áreas del cliente. Solo con un cliente concreto resuelto: gestionar
          áreas sin saber de quién son no significa nada. */}
      {tenantAreas && (
        <AreasCliente
          tenantId={tenantAreas}
          nombreCliente={nombreClienteAreas}
          areas={areasGestion}
          mostrarCliente={soyStaff}
        />
      )}

      {/* Lista */}
      {usuarios.length === 0 ? (
        <EmptyState
          glifo="·"
          titulo="Sin usuarios del cliente"
          descripcion="Da de alta al primer responsable con el botón “Nuevo usuario”."
        />
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <div key={g.nombre} className="space-y-3">
              {grupos.length > 1 && (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {limpiar(g.nombre)}
                </h3>
              )}
              <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
                <ul className="divide-y divide-line/70">
                  {g.filas.map((u) => (
                    <FilaUsuario key={u.id} usuario={u} />
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Liga de invitación lista para compartir. En staging el correo va a la consola,
 * así que ESTA es la vía real de entrega: se muestra completa y se copia de un
 * clic, con su vencimiento a la vista.
 */
export function LigaInvitacion({
  invitacion,
  compacta = false,
}: {
  invitacion: Invitacion;
  compacta?: boolean;
}) {
  const toast = useToast();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(invitacion.url);
      toast.success("Liga de invitación copiada.");
    } catch {
      toast.error("No se pudo copiar. Selecciona la liga y cópiala manualmente.");
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-teal/30 bg-teal/[0.05] px-3.5 py-3",
        compacta && "text-xs"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">
          Liga de invitación · un solo uso
        </p>
        <Button size="sm" variant="secondary" onClick={copiar}>
          <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          Copiar liga
        </Button>
      </div>
      <p className="mt-2 break-all rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-ink">
        {invitacion.url}
      </p>
      <p className="mt-1.5 text-xs text-muted">
        Vence el {fmtFechaHora(invitacion.expiraEn)} ({invitacion.horas} h). Lleva a
        establecer su propia contraseña; después deja de servir.
      </p>
    </div>
  );
}

function CredencialesCard({
  creado,
  onCerrar,
}: {
  creado: NonNullable<AltaUsuarioState["creado"]>;
  onCerrar: () => void;
}) {
  const toast = useToast();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(
        [
          `Usuario: ${creado.email}`,
          `Contraseña temporal: ${creado.passwordTemporal}`,
          creado.invitacion ? `Liga de invitación: ${creado.invitacion.url}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
      toast.success("Credenciales copiadas al portapapeles.");
    } catch {
      toast.error("No se pudo copiar. Copia el texto manualmente.");
    }
  };

  return (
    <div className="rounded-card border border-gold/40 bg-gold/[0.06] p-5 shadow-soft sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">
            Usuario creado — comparte el acceso ahora
          </p>
          <p className="mt-1 text-sm text-muted">
            Comparte la <span className="font-medium">liga de invitación</span> con{" "}
            {limpiar(creado.nombre)} para que establezca su propia contraseña. La
            temporal es el respaldo y <span className="font-medium">no volverá a mostrarse</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Ocultar credenciales"
          className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5">
          <dt className="text-xs uppercase tracking-wide text-muted">Usuario</dt>
          <dd className="mt-0.5 break-all font-medium text-ink">{creado.email}</dd>
        </div>
        <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5">
          <dt className="text-xs uppercase tracking-wide text-muted">Contraseña temporal</dt>
          <dd className="mt-0.5 break-all font-mono text-sm font-semibold text-ink">
            {creado.passwordTemporal}
          </dd>
        </div>
      </dl>

      {creado.invitacion ? (
        <div className="mt-4">
          <LigaInvitacion invitacion={creado.invitacion} />
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-rojo/30 bg-rojo/5 px-3.5 py-2.5 text-xs leading-relaxed text-rojo">
          No se pudo generar la liga de invitación. Comparte la contraseña temporal y
          vuelve a generarla desde el botón “Invitar” de la lista.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="secondary" onClick={copiar}>
          <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          Copiar todo
        </Button>
      </div>
    </div>
  );
}

function FilaUsuario({ usuario }: { usuario: UsuarioFila }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [invitando, startInvitar] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const [invitacion, setInvitacion] = useState<Invitacion | null>(null);

  const aplicar = (activar: boolean) => {
    startTransition(async () => {
      const r = await cambiarActivoUsuario(usuario.id, activar);
      setConfirmar(false);
      if (r.ok) toast.success(r.mensaje ?? "Listo.");
      else toast.error(r.error ?? "No se pudo actualizar.");
    });
  };

  const invitar = () => {
    startInvitar(async () => {
      const r = await regenerarInvitacion(usuario.id);
      if (r.ok && r.invitacion) {
        setInvitacion(r.invitacion);
        toast.success(r.mensaje ?? "Invitación generada.");
      } else {
        toast.error(r.error ?? "No se pudo generar la invitación.");
      }
    });
  };

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5",
        !usuario.activo && "bg-ink/[0.015]"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-medium",
              usuario.activo ? "text-ink" : "text-muted"
            )}
          >
            {limpiar(usuario.nombre)}
          </span>
          {!usuario.activo && <Chip tono="gris">Inactivo</Chip>}
          {usuario.esYo && <Chip tono="teal">Tú</Chip>}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          <span className="break-all">{usuario.email}</span>
          <span>{ROL_LABEL[usuario.rol as Rol] ?? usuario.rol}</span>
          {usuario.area && <span>{usuario.area}</span>}
        </div>
      </div>

      {usuario.activo && usuario.administrable && (
        <button
          type="button"
          onClick={invitar}
          disabled={invitando || pending}
          title="Genera una liga nueva para que establezca su contraseña"
          className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-teal transition duration-150 hover:bg-teal/5 disabled:opacity-50"
        >
          {invitando ? "Generando…" : "Invitar"}
        </button>
      )}

      {!usuario.administrable ? null : usuario.activo ? (
        // Desactivarse a sí mismo dejaría a quien lo hace fuera de su propio
        // panel: no se ofrece (y la server action lo rechaza).
        !usuario.esYo && (
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            disabled={pending}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-rojo transition duration-150 hover:bg-rojo/5 disabled:opacity-50"
          >
            Desactivar
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={() => aplicar(true)}
          disabled={pending}
          className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-teal transition duration-150 hover:bg-teal/5 disabled:opacity-50"
        >
          Reactivar
        </button>
      )}

      {invitacion && (
        <div className="w-full basis-full pt-1">
          <LigaInvitacion invitacion={invitacion} compacta />
        </div>
      )}

      <ConfirmDialog
        open={confirmar}
        tono="danger"
        titulo="¿Desactivar este usuario?"
        descripcion={`${limpiar(
          usuario.nombre
        )} no podrá iniciar sesión hasta que se le reactive. No se elimina: su historia se conserva.`}
        confirmar="Sí, desactivar"
        cancelar="Cancelar"
        cargando={pending}
        onConfirm={() => aplicar(false)}
        onCancel={() => setConfirmar(false)}
      />
    </li>
  );
}

/**
 * Gestión de las ÁREAS del cliente (catálogo `areas_tenant`). Es lo que alimenta
 * el selector de área en el alta de usuarios y en las solicitudes.
 *
 * Renombrar no es un simple cambio de etiqueta: el nombre del área vive también
 * como texto en las solicitudes y en los perfiles, y de esa coincidencia exacta
 * depende qué ve cada usuario de área. Lo resuelve `fn_renombrar_area` en la base,
 * que cambia los tres a la vez o no cambia nada.
 *
 * Las áreas no se borran: se desactivan. El nombre sigue vivo en la evidencia ya
 * entregada, y borrar el catálogo no borraría esa historia — solo la dejaría sin
 * referencia.
 */
function AreasCliente({
  tenantId,
  nombreCliente,
  areas,
  mostrarCliente,
}: {
  tenantId: string;
  nombreCliente: string | null;
  areas: AreaFila[];
  mostrarCliente: boolean;
}) {
  const toast = useToast();
  const [pending, startAccion] = useTransition();
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nombreEdit, setNombreEdit] = useState("");
  const [confirmarBaja, setConfirmarBaja] = useState<AreaFila | null>(null);

  const activas = areas.filter((a) => a.activo);

  const agregar = () => {
    const limpio = nueva.trim();
    if (!limpio) return toast.error("Escribe el nombre del área.");
    startAccion(async () => {
      const r = await crearArea(tenantId, limpio);
      if (r.ok) {
        setNueva("");
        toast.success(r.mensaje ?? "Área creada.");
      } else toast.error(r.error ?? "No se pudo crear el área.");
    });
  };

  const guardarNombre = (area: AreaFila) => {
    const limpio = nombreEdit.trim();
    if (!limpio) return toast.error("Escribe el nombre del área.");
    startAccion(async () => {
      const r = await renombrarArea(area.id, limpio);
      if (r.ok) {
        setEditando(null);
        toast.success(r.mensaje ?? "Área renombrada.");
      } else toast.error(r.error ?? "No se pudo renombrar el área.");
    });
  };

  const alternarActivo = (area: AreaFila, activar: boolean) => {
    startAccion(async () => {
      const r = await cambiarActivoArea(area.id, activar);
      setConfirmarBaja(null);
      if (r.ok) toast.success(r.mensaje ?? "Listo.");
      else toast.error(r.error ?? "No se pudo actualizar el área.");
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          Áreas
          <span className="ml-2 text-sm font-normal text-muted">
            {activas.length} activa{activas.length === 1 ? "" : "s"}
            {areas.length !== activas.length && ` · ${areas.length - activas.length} inactiva(s)`}
            {mostrarCliente && nombreCliente ? ` · ${nombreCliente}` : ""}
          </span>
        </h2>
      </div>

      <div className="rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6">
        <p className="text-xs leading-relaxed text-muted">
          Las áreas que reciben solicitudes. Al renombrar una, el cambio se aplica
          también a sus solicitudes y a los usuarios asignados —de esa coincidencia
          depende qué ve cada quien—. Las áreas no se eliminan: se desactivan, y lo
          ya registrado con ellas se conserva.
        </p>

        {areas.length > 0 && (
          <ul className="mt-4 divide-y divide-line/70 border-y border-line/70">
            {areas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                {editando === a.id ? (
                  <>
                    <label htmlFor={`area-edit-${a.id}`} className="sr-only">
                      Nombre del área
                    </label>
                    <input
                      id={`area-edit-${a.id}`}
                      value={nombreEdit}
                      onChange={(e) => setNombreEdit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          guardarNombre(a);
                        }
                        if (e.key === "Escape") setEditando(null);
                      }}
                      maxLength={AREA_MAX}
                      className="h-9 min-w-[12rem] flex-1 rounded-xl border border-line bg-crema/40 px-3 text-sm text-ink outline-none transition duration-150 focus:border-teal/50 focus:bg-surface"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => guardarNombre(a)}
                      loading={pending}
                    >
                      Guardar
                    </Button>
                    <button
                      type="button"
                      onClick={() => setEditando(null)}
                      className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-sm font-medium",
                        a.activo ? "text-ink" : "text-muted"
                      )}
                    >
                      {a.nombre}
                    </span>
                    {!a.activo && <Chip tono="gris">Inactiva</Chip>}
                    {a.activo && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setEditando(a.id);
                          setNombreEdit(a.nombre);
                        }}
                        className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-teal transition duration-150 hover:bg-teal/5 disabled:opacity-50"
                      >
                        Renombrar
                      </button>
                    )}
                    {a.activo ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirmarBaja(a)}
                        className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-rojo transition duration-150 hover:bg-rojo/5 disabled:opacity-50"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => alternarActivo(a, true)}
                        className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-teal transition duration-150 hover:bg-teal/5 disabled:opacity-50"
                      >
                        Reactivar
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="area-nueva" className="sr-only">
            Nueva área
          </label>
          <input
            id="area-nueva"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar();
              }
            }}
            maxLength={AREA_MAX}
            placeholder="Nueva área (p. ej. Legal)"
            className="h-10 w-60 rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={agregar}
            disabled={!nueva.trim()}
            loading={pending}
          >
            Agregar área
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmarBaja != null}
        tono="danger"
        titulo="¿Desactivar esta área?"
        descripcion={`“${confirmarBaja?.nombre ?? ""}” dejará de ofrecerse al asignar usuarios y solicitudes. Lo ya registrado con ella —solicitudes, evidencia y bitácora— se conserva sin cambios, y puedes reactivarla cuando quieras.`}
        confirmar="Sí, desactivar"
        cancelar="Cancelar"
        cargando={pending}
        onConfirm={() => confirmarBaja && alternarActivo(confirmarBaja, false)}
        onCancel={() => setConfirmarBaja(null)}
      />
    </section>
  );
}
