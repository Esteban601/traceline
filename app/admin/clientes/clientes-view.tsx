"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { fmtFecha } from "@/lib/fechas";
import {
  AREAS_ESTANDAR,
  AREA_MAX,
  NOMBRE_MAX,
  SLUG_MAX,
  limpiarNombreTenant,
  prefijoSugerido,
  slugSugerido,
  validarPrefijo,
  validarSlug,
} from "@/lib/tenants";
import { LogoUploader } from "./logo-uploader";
import { cambiarActivoTenant, crearCliente, type AltaClienteState } from "./actions";

export type ClienteFila = {
  id: string;
  nombre: string;
  slug: string;
  prefijoFolio: string;
  logoUrl: string | null;
  activo: boolean;
  createdAt: string;
  areas: string[];
  usuarios: number;
  reportes: number;
};

const initialAlta: AltaClienteState = { ok: false, error: null, creado: null };

const labelCls = "block text-sm font-medium text-ink";
const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60";
const ayudaCls = "mt-1.5 text-xs leading-relaxed text-muted";

export function ClientesView({ clientes }: { clientes: ClienteFila[] }) {
  const toast = useToast();
  const [abrirAlta, setAbrirAlta] = useState(false);
  const [state, dispatch, pending] = useActionState(crearCliente, initialAlta);
  const [creado, setCreado] = useState<AltaClienteState["creado"]>(null);

  // Formulario controlado. `slug` y `prefijo` se sugieren desde el nombre hasta
  // que el usuario los edita a mano; a partir de ahí manda lo que escribió.
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [prefijo, setPrefijo] = useState("");
  const [prefijoTocado, setPrefijoTocado] = useState(false);
  const [areasEstandar, setAreasEstandar] = useState<string[]>([...AREAS_ESTANDAR]);
  const [areasExtra, setAreasExtra] = useState<string[]>([]);
  const [areaNueva, setAreaNueva] = useState("");

  const areas = [...areasEstandar, ...areasExtra];
  const errSlug = slug ? validarSlug(slug) : null;
  const errPrefijo = prefijo ? validarPrefijo(prefijo) : null;

  useEffect(() => {
    if (state.ok && state.creado) {
      setCreado(state.creado);
      toast.success("Cliente creado. Ya puede recibir su primer reporte.");
      limpiarFormulario();
      setAbrirAlta(false);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function limpiarFormulario() {
    setNombre("");
    setSlug("");
    setSlugTocado(false);
    setPrefijo("");
    setPrefijoTocado(false);
    setAreasEstandar([...AREAS_ESTANDAR]);
    setAreasExtra([]);
    setAreaNueva("");
  }

  const onNombre = (valor: string) => {
    setNombre(valor);
    if (!slugTocado) setSlug(slugSugerido(valor));
    if (!prefijoTocado) setPrefijo(prefijoSugerido(valor));
  };

  const alternarEstandar = (area: string) =>
    setAreasEstandar((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );

  const agregarArea = () => {
    const limpia = areaNueva.trim().replace(/\s+/g, " ");
    if (!limpia) return;
    const yaEsta = areas.some((a) => a.toLocaleLowerCase("es") === limpia.toLocaleLowerCase("es"));
    if (yaEsta) {
      toast.error(`El área “${limpia}” ya está en la lista.`);
      return;
    }
    setAreasExtra((prev) => [...prev, limpia.slice(0, AREA_MAX)]);
    setAreaNueva("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return toast.error("El nombre del cliente es obligatorio.");
    const eSlug = validarSlug(slug);
    if (eSlug) return toast.error(eSlug);
    const ePrefijo = validarPrefijo(prefijo);
    if (ePrefijo) return toast.error(ePrefijo);
    if (areas.length === 0) {
      return toast.error("Elige al menos un área: sin áreas el cliente no puede recibir solicitudes.");
    }

    const fd = new FormData();
    fd.set("nombre", nombre);
    fd.set("slug", slug);
    fd.set("prefijo_folio", prefijo);
    for (const a of areas) fd.append("areas", a);
    startTransition(() => dispatch(fd));
  };

  const activos = clientes.filter((c) => c.activo).length;

  return (
    <div className="space-y-8">
      {creado && <SiguientePaso creado={creado} onCerrar={() => setCreado(null)} />}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">
            Clientes
            <span className="ml-2 text-sm font-normal text-muted">
              {clientes.length}
              {clientes.length !== activos && ` · ${activos} activos`}
            </span>
          </h2>
          <Button size="sm" onClick={() => setAbrirAlta((v) => !v)}>
            {abrirAlta ? "Cerrar" : "Nuevo cliente"}
          </Button>
        </div>

        {abrirAlta && (
          <form
            onSubmit={onSubmit}
            className="space-y-6 rounded-card border border-line bg-surface p-6 shadow-soft"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="c-nombre" className={labelCls}>
                  Nombre del cliente
                </label>
                <input
                  id="c-nombre"
                  value={nombre}
                  onChange={(e) => onNombre(e.target.value)}
                  maxLength={NOMBRE_MAX}
                  required
                  placeholder="Grupo Alfa SAB de CV"
                  className={inputCls}
                />
                <p className={ayudaCls}>Como aparece en el informe y en su portal.</p>
              </div>

              <div>
                <label htmlFor="c-slug" className={labelCls}>
                  Identificador (slug)
                </label>
                <input
                  id="c-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTocado(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  maxLength={SLUG_MAX}
                  required
                  placeholder="grupo-alfa"
                  aria-invalid={errSlug ? true : undefined}
                  className={cn(inputCls, errSlug && "border-rojo/50")}
                />
                <p className={cn(ayudaCls, errSlug && "text-rojo")}>
                  {errSlug ?? "Se genera del nombre; puedes editarlo. Único, minúsculas y guiones."}
                </p>
              </div>
            </div>

            {/* El prefijo va solo en su renglón, a media caja: emparejarlo con
                otro campo obligaría a inventar uno. */}
            <div className="sm:w-[calc(50%-0.75rem)]">
              <div>
                <label htmlFor="c-prefijo" className={labelCls}>
                  Prefijo de folios
                </label>
                <input
                  id="c-prefijo"
                  value={prefijo}
                  onChange={(e) => {
                    setPrefijoTocado(true);
                    setPrefijo(e.target.value.toUpperCase().slice(0, 4));
                  }}
                  maxLength={4}
                  required
                  placeholder="ALFA"
                  aria-invalid={errPrefijo ? true : undefined}
                  className={cn(inputCls, "font-mono tracking-[0.2em]", errPrefijo && "border-rojo/50")}
                />
                <p className={cn(ayudaCls, errPrefijo && "text-rojo")}>
                  {errPrefijo ?? "3 o 4 letras mayúsculas, únicas. Identifica al cliente de un vistazo."}
                </p>
              </div>
            </div>

            <fieldset>
              <legend className={labelCls}>Áreas iniciales</legend>
              <p className={ayudaCls}>
                Las áreas del cliente que recibirán solicitudes. Podrás ajustarlas después.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {AREAS_ESTANDAR.map((area) => {
                  const activa = areasEstandar.includes(area);
                  return (
                    <label
                      key={area}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-2 rounded-pill border px-3.5 py-1.5 text-sm font-medium transition duration-150",
                        activa
                          ? "border-teal/40 bg-teal/10 text-teal"
                          : "border-line bg-surface text-muted hover:border-teal/30 hover:text-ink"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={activa}
                        onChange={() => alternarEstandar(area)}
                        className="size-4 accent-teal"
                      />
                      {area}
                    </label>
                  );
                })}

                {areasExtra.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-sm font-medium text-gold"
                  >
                    {area}
                    <button
                      type="button"
                      onClick={() => setAreasExtra((prev) => prev.filter((a) => a !== area))}
                      aria-label={`Quitar el área ${area}`}
                      className="-mr-1 rounded-md p-0.5 transition duration-150 hover:bg-gold/15"
                    >
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label htmlFor="c-area-nueva" className="sr-only">
                  Agregar área personalizada
                </label>
                <input
                  id="c-area-nueva"
                  value={areaNueva}
                  onChange={(e) => setAreaNueva(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarArea();
                    }
                  }}
                  maxLength={AREA_MAX}
                  placeholder="Otra área (p. ej. Legal)"
                  className="h-10 w-56 rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={agregarArea}
                  disabled={!areaNueva.trim()}
                >
                  Agregar área
                </Button>
              </div>

              {areas.length === 0 && (
                <p className="mt-2.5 text-xs font-medium text-rojo">
                  Elige al menos un área: sin áreas el cliente no puede recibir solicitudes.
                </p>
              )}
            </fieldset>

            <div className="flex justify-end gap-2.5 border-t border-line pt-6">
              <button
                type="button"
                onClick={() => {
                  limpiarFormulario();
                  setAbrirAlta(false);
                }}
                className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
              >
                Cancelar
              </button>
              <Button type="submit" loading={pending}>
                Crear cliente
              </Button>
            </div>
          </form>
        )}
      </section>

      {clientes.length === 0 ? (
        <EmptyState
          glifo="◇"
          titulo="Aún no hay clientes"
          descripcion="Da de alta la primera emisora con el botón “Nuevo cliente”."
        />
      ) : (
        <ul className="space-y-4">
          {clientes.map((c) => (
            <ClienteCard key={c.id} cliente={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * El alta no termina en "creado": termina cuando el cliente tiene reporte y
 * usuarios. Esta tarjeta encadena los dos pasos siguientes con el cliente nuevo
 * ya preseleccionado.
 */
function SiguientePaso({
  creado,
  onCerrar,
}: {
  creado: NonNullable<AltaClienteState["creado"]>;
  onCerrar: () => void;
}) {
  const nombre = limpiarNombreTenant(creado.nombre);
  const pasoCls =
    "flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition duration-150 hover:border-teal/40";

  return (
    <div className="rounded-card border border-teal/30 bg-teal/[0.05] p-5 shadow-soft sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">
            Cliente creado
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink">
            {nombre} está listo para operar
          </h2>
          <p className="mt-1 text-sm text-muted">
            Folios <span className="font-mono font-semibold text-ink">{creado.prefijoFolio}</span> ·{" "}
            {creado.areas.length} {creado.areas.length === 1 ? "área creada" : "áreas creadas"} (
            {creado.areas.join(", ")}). Continúa con:
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Ocultar los siguientes pasos"
          className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href={`/admin/plantillas?tenant=${creado.id}`} className={pasoCls}>
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-teal text-xs font-semibold text-crema"
          >
            1
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">Crea su primer reporte</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              Desde una plantilla de checklist existente, con {nombre} ya seleccionado.
            </span>
          </span>
        </Link>

        <Link href={`/admin/usuarios?tenant=${creado.id}`} className={pasoCls}>
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-teal text-xs font-semibold text-crema"
          >
            2
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">Da de alta a sus usuarios</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              Con liga de invitación para que cada quien establezca su contraseña.
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}

function ClienteCard({ cliente }: { cliente: ClienteFila }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const nombre = limpiarNombreTenant(cliente.nombre);

  const aplicar = (activar: boolean) => {
    startTransition(async () => {
      const r = await cambiarActivoTenant(cliente.id, activar);
      setConfirmar(false);
      if (r.ok) toast.success(r.mensaje ?? "Listo.");
      else toast.error(r.error ?? "No se pudo actualizar el cliente.");
    });
  };

  return (
    <li
      className={cn(
        "rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6",
        !cliente.activo && "bg-ink/[0.015]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <TenantLogo nombre={cliente.nombre} logoUrl={cliente.logoUrl} tamano="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={cn(
                  "font-display text-base font-semibold",
                  cliente.activo ? "text-ink" : "text-muted"
                )}
              >
                {nombre}
              </h3>
              <span className="rounded-pill bg-teal/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-teal">
                {cliente.prefijoFolio}
              </span>
              {!cliente.activo && <Chip tono="gris">Inactivo</Chip>}
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted">{cliente.slug}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
              <span>
                {cliente.areas.length} {cliente.areas.length === 1 ? "área" : "áreas"}
                {cliente.areas.length > 0 && `: ${cliente.areas.join(", ")}`}
              </span>
              <span>
                {cliente.usuarios} {cliente.usuarios === 1 ? "usuario" : "usuarios"}
              </span>
              <span>
                {cliente.reportes} {cliente.reportes === 1 ? "reporte" : "reportes"}
              </span>
              <span>Alta {fmtFecha(cliente.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cliente.activo ? (
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
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <LogoUploader
          tenantId={cliente.id}
          nombre={cliente.nombre}
          logoUrl={cliente.logoUrl}
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/usuarios?tenant=${cliente.id}`}
            className="inline-flex h-9 items-center rounded-lg border border-line px-3.5 text-sm font-medium text-muted transition duration-150 hover:border-teal/40 hover:text-teal"
          >
            Usuarios
          </Link>
          <Link
            href={`/admin?tenant=${cliente.id}`}
            className="inline-flex h-9 items-center rounded-lg border border-line px-3.5 text-sm font-medium text-muted transition duration-150 hover:border-teal/40 hover:text-teal"
          >
            Ver matriz
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirmar}
        tono="danger"
        titulo="¿Desactivar este cliente?"
        descripcion={`${nombre} dejará de ofrecerse para trabajo nuevo y sus usuarios no podrán ingresar. No se elimina nada: su reporte, su evidencia y su bitácora se conservan, y puedes reactivarlo cuando quieras.`}
        confirmar="Sí, desactivar"
        cancelar="Cancelar"
        cargando={pending}
        onConfirm={() => aplicar(false)}
        onCancel={() => setConfirmar(false)}
      />
    </li>
  );
}
