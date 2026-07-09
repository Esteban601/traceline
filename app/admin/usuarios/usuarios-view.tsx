"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { ROLES_CLIENTE } from "@/lib/gestion";
import {
  crearUsuario,
  cambiarActivoUsuario,
  type AltaUsuarioState,
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
};
export type TenantOpcion = { id: string; nombre: string };

function limpiar(nombre: string): string {
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

const ROL_LABEL: Record<string, string> = {
  cliente: "Cliente",
  coordinador: "Coordinador",
  analista: "Analista",
  admin: "Admin",
};

const initialAlta: AltaUsuarioState = { ok: false, error: null, creado: null };

const labelCls = "block text-sm font-medium text-ink";
const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60";

export function UsuariosView({
  usuarios,
  tenants,
  areas,
}: {
  usuarios: UsuarioFila[];
  tenants: TenantOpcion[];
  areas: { tenant_id: string; area: string }[];
}) {
  const toast = useToast();
  const [abrirAlta, setAbrirAlta] = useState(false);
  const [state, dispatch, pending] = useActionState(crearUsuario, initialAlta);

  // Formulario controlado.
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState(tenants.length === 1 ? tenants[0].id : "");
  const [rol, setRol] = useState<string>("cliente");
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
      setRol("cliente");
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
    fd.set("area", rol === "cliente" ? area : "");
    dispatch(fd);
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
                    onChange={(e) => setTenantId(e.target.value)}
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
                  {ROLES_CLIENTE.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="u-area" className={labelCls}>
                  Área{" "}
                  <span className="font-normal text-muted">
                    {rol === "cliente" ? "" : "· no aplica"}
                  </span>
                </label>
                <input
                  id="u-area"
                  list="areas-usuario"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  disabled={rol !== "cliente"}
                  placeholder={rol === "cliente" ? "RH, Operaciones…" : "—"}
                  className={inputCls}
                />
                <datalist id="areas-usuario">
                  {areasTenant.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
            </div>

            <p className="rounded-xl border border-dashed border-line bg-crema/30 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
              Se generará una contraseña temporal que verás una sola vez para
              compartir con la persona. La invitación por correo con enlace mágico
              queda como mejora de producción (en staging no hay envío).
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
        `Usuario: ${creado.email}\nContraseña temporal: ${creado.passwordTemporal}`
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
            Usuario creado — copia la contraseña ahora
          </p>
          <p className="mt-1 text-sm text-muted">
            Esta contraseña temporal <span className="font-medium">no volverá a mostrarse</span>.
            Compártela con {limpiar(creado.nombre)}.
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

      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="secondary" onClick={copiar}>
          <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          Copiar credenciales
        </Button>
      </div>
    </div>
  );
}

function FilaUsuario({ usuario }: { usuario: UsuarioFila }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmar, setConfirmar] = useState(false);

  const aplicar = (activar: boolean) => {
    startTransition(async () => {
      const r = await cambiarActivoUsuario(usuario.id, activar);
      setConfirmar(false);
      if (r.ok) toast.success(r.mensaje ?? "Listo.");
      else toast.error(r.error ?? "No se pudo actualizar.");
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
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          <span className="break-all">{usuario.email}</span>
          <span>{ROL_LABEL[usuario.rol] ?? usuario.rol}</span>
          {usuario.area && <span>{usuario.area}</span>}
        </div>
      </div>

      {usuario.activo ? (
        <button
          type="button"
          onClick={() => setConfirmar(true)}
          disabled={pending}
          className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-rojo transition duration-150 hover:bg-rojo/5 disabled:opacity-50"
        >
          Desactivar
        </button>
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
