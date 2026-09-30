import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPerfilActual, esAdminIrstrat } from "@/lib/data";
import {
  agrupar,
  leerActividad,
  opcionesDeFiltro,
  TIPO_LABEL,
  VENTANA_MS,
} from "@/lib/auditoria-vista";
import { limpiarNombreTenant } from "@/lib/tenants";
import { fmtFechaHora } from "@/lib/fechas";
import { EmptyState } from "@/components/ui/empty-state";
import { FiltrosAuditoria } from "./filtros";

export const metadata: Metadata = { title: "Actividad de auditores" };

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    auditor?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login");

  // SOLO el administrador de IRStrat. No el analista, no el administrador del
  // cliente, no el auditor. La base dice lo mismo —auditor_actividad_select usa
  // fn_is_admin_irstrat()—; esto es la defensa de página, para que una URL
  // tecleada no llegue ni a renderizar.
  //
  // Que el ADMIN DEL CLIENTE no la vea es deliberado: son los movimientos de un
  // tercero contratado para revisarlo a él, y dárselos convertiría la
  // trazabilidad del aseguramiento en vigilancia sobre su propio auditor.
  if (!esAdminIrstrat(perfil)) redirect("/admin");

  const f = await searchParams;
  const filtro = {
    tenantId: f.tenant || null,
    auditorId: f.auditor || null,
    desde: f.desde || null,
    hasta: f.hasta || null,
  };

  const [actos, opciones] = await Promise.all([
    leerActividad(filtro),
    opcionesDeFiltro(),
  ]);
  const tramos = agrupar(actos);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({
    tenant: filtro.tenantId,
    auditor: filtro.auditorId,
    desde: filtro.desde,
    hasta: filtro.hasta,
  })) {
    if (v) qs.set(k, v);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
            Panel interno IRStrat · Aseguramiento
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
            Actividad de auditores
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Qué miró y qué se llevó cada auditor externo. Solo lo ve la
            administración de IRStrat. Las vistas idénticas seguidas del mismo
            objeto se agrupan en ventanas de {VENTANA_MS / 1000} segundos para
            que se lea; el registro guardado conserva cada una, y así sale en el
            CSV.
          </p>
        </div>
        <Link
          href={`/admin/auditoria/csv${qs.size ? `?${qs}` : ""}`}
          prefetch={false}
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-ink shadow-soft transition duration-150 hover:border-teal/40 hover:text-teal"
        >
          Exportar CSV
        </Link>
      </header>

      <FiltrosAuditoria
        tenants={opciones.tenants.map((t) => ({
          id: t.id,
          nombre: limpiarNombreTenant(t.nombre),
        }))}
        auditores={opciones.auditores}
        valores={{
          tenant: filtro.tenantId ?? "",
          auditor: filtro.auditorId ?? "",
          desde: filtro.desde ?? "",
          hasta: filtro.hasta ?? "",
        }}
      />

      {tramos.length === 0 ? (
        <EmptyState
          glifo="◷"
          titulo="Sin actividad registrada"
          descripcion="No hay movimientos de auditores con esos filtros. El registro empieza a llenarse en cuanto un auditor entra."
        />
      ) : (
        <>
          <p className="text-sm text-muted">
            {tramos.length} {tramos.length === 1 ? "tramo" : "tramos"} · {actos.length}{" "}
            {actos.length === 1 ? "acto registrado" : "actos registrados"}
          </p>

          <ol className="relative space-y-0 border-l border-line pl-5">
            {tramos.map((t) => (
              <li key={t.id} className="relative py-3">
                <span
                  aria-hidden
                  className="absolute -left-[23px] top-[18px] size-2 rounded-full bg-teal"
                />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-ink">
                    {TIPO_LABEL[t.tipo]}
                  </span>
                  {t.repeticiones > 1 && (
                    <span className="rounded-pill bg-ink/[0.06] px-2 py-0.5 text-[11px] font-medium text-muted">
                      ×{t.repeticiones}
                    </span>
                  )}
                  {t.archivo && (
                    <span className="truncate text-sm text-ink/80">{t.archivo}</span>
                  )}
                  {t.objetoTipo && !t.archivo && (
                    <span className="text-sm text-muted">{t.objetoTipo}</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span>{t.auditorNombre}</span>
                  <span>{limpiarNombreTenant(t.tenantNombre)}</span>
                  <time dateTime={t.createdAt}>
                    {fmtFechaHora(t.hasta)}
                    {t.repeticiones > 1 && t.hasta !== t.createdAt
                      ? ` – ${fmtFechaHora(t.createdAt)}`
                      : ""}
                  </time>
                  {t.ip && <span className="tabular-nums">{t.ip}</span>}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
