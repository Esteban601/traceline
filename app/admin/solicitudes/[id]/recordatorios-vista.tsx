import Link from "next/link";
import { etiquetaDias, fechaDisparo } from "@/lib/recordatorios-plan";
import { fmtDiaLargo, fmtFechaHora } from "@/lib/fechas";
import type { EstadoSolicitud } from "@/lib/estados";

// =============================================================================
// Recordatorios de una solicitud, en su detalle: lo CONFIGURADO y lo YA ENVIADO.
//
// De solo lectura a propósito: el calendario se edita donde se edita la fecha
// límite —en el formulario de la solicitud—, porque son la misma decisión. Aquí lo
// que importa es responder dos preguntas de operación: ¿cuándo le va a llegar a mi
// gente?, y ¿ya le llegó?
// =============================================================================

export type RecordatorioConfig = { id: string; dias_antes: number; activo: boolean };
export type EnvioRecordatorio = {
  id: string;
  created_at: string;
  recordatorio_id: string | null;
  dias_antes: number | null;
  fecha_disparo: string | null;
  destinatarios: number | null;
  email: string | null;
};

export function RecordatoriosVista({
  solicitudId,
  fechaLimite,
  estado,
  configurados,
  envios,
  puedeConfigurar,
}: {
  solicitudId: string;
  fechaLimite: string | null;
  estado: EstadoSolicitud;
  configurados: RecordatorioConfig[];
  envios: EnvioRecordatorio[];
  puedeConfigurar: boolean;
}) {
  const activos = configurados.filter((r) => r.activo);
  const apagados = configurados.filter((r) => !r.activo);
  const cumplida = estado === "validado" || estado === "congelado";

  // Un envío por destinatario: para la vista se cuenta un disparo por
  // (recordatorio, fecha), con el total de personas a las que salió.
  const disparos = new Map<
    string,
    { cuando: string; dias: number | null; personas: number; correos: string[] }
  >();
  for (const e of envios) {
    const clave = `${e.recordatorio_id ?? "?"}|${e.fecha_disparo ?? e.created_at.slice(0, 10)}`;
    const prev = disparos.get(clave);
    if (prev) {
      prev.personas += 1;
      if (e.email) prev.correos.push(e.email);
    } else {
      disparos.set(clave, {
        cuando: e.created_at,
        dias: e.dias_antes,
        personas: 1,
        correos: e.email ? [e.email] : [],
      });
    }
  }
  const listaDisparos = [...disparos.values()].sort((a, b) => b.cuando.localeCompare(a.cuando));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">Recordatorios</h2>
        {puedeConfigurar && (
          <Link
            href={`/admin/solicitudes/${solicitudId}/editar`}
            className="text-sm font-medium text-teal underline decoration-teal/30 underline-offset-4 transition hover:decoration-teal"
          >
            Configurar
          </Link>
        )}
      </div>

      <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
        {activos.length === 0 ? (
          <p className="text-sm text-muted">
            Sin recordatorios activos: esta solicitud no genera avisos automáticos.
            {apagados.length > 0 && (
              <>
                {" "}
                Hay {apagados.length}{" "}
                {apagados.length === 1 ? "configurado y apagado" : "configurados y apagados"} (
                {apagados.map((r) => etiquetaDias(r.dias_antes)).join(", ")}).
              </>
            )}
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {activos
                .slice()
                .sort((a, b) => b.dias_antes - a.dias_antes)
                .map((r) => {
                  const cuando = fechaLimite ? fechaDisparo(fechaLimite, r.dias_antes) : null;
                  const yaSalio = listaDisparos.find((d) => d.dias === r.dias_antes);
                  return (
                    <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-medium text-ink">{etiquetaDias(r.dias_antes)}</span>
                      <span className="text-muted">
                        {cuando ? `— ${fmtDiaLargo(cuando)}` : "— requiere fecha límite"}
                      </span>
                      {yaSalio && (
                        <span className="rounded-pill bg-verde/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-verde">
                          Enviado
                        </span>
                      )}
                    </li>
                  );
                })}
            </ul>

            {!fechaLimite && (
              <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
                <span className="font-medium text-ink">Sin fecha límite no disparan.</span> El
                calendario ya está configurado y empieza a contar en cuanto se ponga el plazo.
              </p>
            )}
            {fechaLimite && cumplida && (
              <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
                La solicitud ya está {estado === "validado" ? "validada" : "congelada"}: no se
                enviarán más recordatorios. Recordar lo cumplido es ruido.
              </p>
            )}
            {apagados.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                Apagados: {apagados.map((r) => etiquetaDias(r.dias_antes)).join(", ")}.
              </p>
            )}
          </>
        )}
      </div>

      {listaDisparos.length > 0 && (
        <div className="rounded-card border border-line bg-crema/20 p-5">
          <h3 className="text-sm font-semibold text-ink">Ya enviados</h3>
          <ul className="mt-2.5 space-y-1.5 text-sm text-muted">
            {listaDisparos.map((d, i) => (
              <li key={i}>
                <span className="text-ink">
                  {d.dias != null ? etiquetaDias(d.dias) : "Recordatorio"}
                </span>{" "}
                — {fmtFechaHora(d.cuando)} · {d.personas}{" "}
                {d.personas === 1 ? "destinatario" : "destinatarios"}
                {d.correos.length > 0 && (
                  <span className="text-muted/80"> ({d.correos.join(", ")})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
