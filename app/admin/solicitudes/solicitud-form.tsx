"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { NOTA_ALCANCE_MAX } from "@/lib/gestion";
import { PRESETS_DEFAULT_ACTIVOS } from "@/lib/recordatorios-plan";
import { AreasSelector } from "./areas-selector";
import { RecordatoriosSeccion } from "./recordatorios-seccion";
import { DatapointSelector, type DatapointOpcion } from "./datapoint-selector";
import type { GestionState } from "./gestion-actions";

const initial: GestionState = { ok: false, error: null, mensaje: null, solicitudId: null };

export type ReporteOpcion = {
  id: string;
  nombre: string;
  ejercicio: number;
  tenant_id: string;
  /** 'congelado' = cerrado para aseguramiento; no admite solicitudes nuevas. */
  estado: "activo" | "congelado";
};
export type UsuarioOpcion = {
  id: string;
  nombre: string;
  tenant_id: string | null;
  area: string | null;
};
export type StaffOpcion = { id: string; nombre: string };
/** Rubro canónico de la plantilla oficial, ya con su grupo legible. */
export type RubroOpcion = {
  clave: string;
  etiqueta: string;
  grupoLabel: string;
};

export type ValoresIniciales = {
  solicitudId: string;
  reporteId: string;
  titulo: string;
  descripcion: string;
  area_asignada: string;
  es_cuantitativa: boolean;
  unidad_esperada: string;
  fecha_limite: string;
  responsable_cliente_id: string;
  responsable_irstrat_id: string;
  orden: string;
  rubro_clave: string;
  rubro_taxonomia: string;
  nota_alcance: string;
  datapointIds: string[];
  /** Días ACTIVOS de recordatorio ya configurados para esta solicitud. */
  recordatorios: number[];
};

function limpiar(nombre: string): string {
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

const labelCls = "block text-sm font-medium text-ink";
const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60";
const areaCls =
  "mt-1.5 w-full resize-y rounded-xl border border-line bg-crema/40 px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60";

export function SolicitudForm({
  modo,
  action,
  reportes,
  usuariosCliente,
  staff,
  areas,
  datapoints,
  rubros,
  inicial,
  enunciadoBloqueado = false,
  soloCliente = false,
}: {
  modo: "crear" | "editar";
  action: (prev: GestionState, fd: FormData) => Promise<GestionState>;
  reportes: ReporteOpcion[];
  usuariosCliente: UsuarioOpcion[];
  staff: StaffOpcion[];
  areas: { tenant_id: string; area: string }[];
  datapoints: DatapointOpcion[];
  rubros: RubroOpcion[];
  inicial?: ValoresIniciales;
  enunciadoBloqueado?: boolean;
  /**
   * Modo ADMINISTRADOR DEL CLIENTE: sin responsable de IRStrat y sin mapeo a
   * datapoints (esos dos son trabajo de la firma; la server action los ignora y
   * RLS los niega). El rubro de taxonomía SÍ se ofrece: es lo que hace que el
   * valor de una solicitud interna llene su celda del Excel.
   */
  soloCliente?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, dispatch, pending] = useActionState(action, initial);

  const [reporteId, setReporteId] = useState(
    inicial?.reporteId ?? (reportes.length === 1 ? reportes[0].id : "")
  );
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  // Áreas en PLURAL: una sola es la solicitud de siempre; dos o más, una difusión
  // (una copia por área). Al EDITAR nunca hay multi-selección: se edita una copia
  // concreta, y cambiar su área no puede convertirla en varias.
  const [areasSel, setAreasSel] = useState<string[]>(
    inicial?.area_asignada ? [inicial.area_asignada] : []
  );
  // Área escrita a mano y aún sin "Agregar": la gobierna el formulario para poder
  // incluirla al enviar. Sin esto, escribirla y pulsar "Crear solicitud" la perdía.
  const [areaLibre, setAreaLibre] = useState("");
  const areasFinales = (() => {
    const pendiente = areaLibre.trim();
    if (!pendiente || areasSel.includes(pendiente)) return areasSel;
    return modo === "editar" ? [pendiente] : [...areasSel, pendiente];
  })();
  const difusion = modo === "crear" && areasFinales.length > 1;
  const [esCuant, setEsCuant] = useState(inicial?.es_cuantitativa ?? false);
  const [unidad, setUnidad] = useState(inicial?.unidad_esperada ?? "");
  const [fechaLimite, setFechaLimite] = useState(inicial?.fecha_limite ?? "");
  const [respCliente, setRespCliente] = useState(inicial?.responsable_cliente_id ?? "");
  const [respIrstrat, setRespIrstrat] = useState(inicial?.responsable_irstrat_id ?? "");
  const [orden, setOrden] = useState(inicial?.orden ?? "");
  const [rubroClave, setRubroClave] = useState(inicial?.rubro_clave ?? "");
  const [rubroTaxonomia, setRubroTaxonomia] = useState(inicial?.rubro_taxonomia ?? "");
  const [notaAlcance, setNotaAlcance] = useState(inicial?.nota_alcance ?? "");
  const [datapointIds, setDatapointIds] = useState<string[]>(inicial?.datapointIds ?? []);
  // Al crear, la solicitud nace con los presets default encendidos (la server
  // action aplica los mismos si el formulario no trae la sección, y son los que
  // heredan las solicitudes clonadas de plantilla: un solo criterio en los tres
  // caminos).
  const [recordatorios, setRecordatorios] = useState<number[]>(
    inicial?.recordatorios ?? [...PRESETS_DEFAULT_ACTIVOS]
  );

  const reporte = useMemo(
    () => reportes.find((r) => r.id === reporteId) ?? null,
    [reportes, reporteId]
  );
  const tenantId = reporte?.tenant_id ?? null;

  // Responsables y áreas se acotan al tenant del reporte seleccionado.
  const responsablesCliente = useMemo(
    () => usuariosCliente.filter((u) => u.tenant_id === tenantId),
    [usuariosCliente, tenantId]
  );
  const areasTenant = useMemo(() => {
    const set = new Set<string>();
    for (const a of areas) if (a.tenant_id === tenantId && a.area) set.add(a.area);
    for (const u of responsablesCliente) if (u.area) set.add(u.area);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [areas, tenantId, responsablesCliente]);

  // Si cambia el tenant y el responsable cliente ya no pertenece, se limpia.
  useEffect(() => {
    if (respCliente && !responsablesCliente.some((u) => u.id === respCliente)) {
      setRespCliente("");
    }
  }, [responsablesCliente, respCliente]);

  useEffect(() => {
    if (state.ok) {
      if (state.mensaje) toast.success(state.mensaje);
      const destino = state.solicitudId
        ? `/admin/solicitudes/${state.solicitudId}`
        : "/admin";
      router.push(destino);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporteId) {
      toast.error("Selecciona el reporte.");
      return;
    }
    if (!titulo.trim()) {
      toast.error("El título es obligatorio.");
      return;
    }
    const fd = new FormData();
    if (modo === "editar" && inicial) fd.set("solicitud_id", inicial.solicitudId);
    fd.set("reporte_id", reporteId);
    fd.set("titulo", titulo);
    fd.set("descripcion", descripcion);
    fd.set("areas_presentes", "1");
    for (const a of areasFinales) fd.append("area_asignada", a);
    if (esCuant) fd.set("es_cuantitativa", "on");
    fd.set("unidad_esperada", unidad);
    fd.set("fecha_limite", fechaLimite);
    fd.set("responsable_cliente_id", respCliente);
    // En modo cliente este campo no se muestra ni se envía: no es suyo. La server
    // action lo ignora igualmente, pero mandar un valor que el usuario no ve ni
    // controla solo invita a que alguien lo tome por editable.
    if (!soloCliente) fd.set("responsable_irstrat_id", respIrstrat);
    fd.set("orden", orden);
    fd.set("rubro_clave", rubroClave);
    // En una difusión el rubro NO viaja: la celda del entregable la llena una sola
    // solicitud, y N copias peleándose por ella producirían un Excel indefinido.
    // Se asigna después, desde el detalle de la copia que resultó ser la dueña.
    fd.set("rubro_taxonomia", difusion ? "" : rubroTaxonomia);
    if (!soloCliente) fd.set("nota_alcance", notaAlcance);
    for (const id of datapointIds) fd.append("datapoint_ids", id);
    // Centinela + lista: la server action distingue "ninguno" de "sin sección".
    fd.set("recordatorios_presentes", "1");
    for (const d of recordatorios) fd.append("recordatorio_dias", String(d));
    startTransition(() => dispatch(fd));
  };

  const cancelar = inicial ? `/admin/solicitudes/${inicial.solicitudId}` : "/admin";

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Reporte */}
      <div>
        <label htmlFor="reporte_id" className={labelCls}>
          Reporte
        </label>
        {modo === "editar" || reportes.length <= 1 ? (
          <p className="mt-1.5 rounded-xl border border-line bg-crema/30 px-3.5 py-3 text-sm text-ink">
            {reporte
              ? `${limpiar(reporte.nombre)} · ${reporte.ejercicio}`
              : "Sin reportes disponibles"}
          </p>
        ) : (
          <select
            id="reporte_id"
            value={reporteId}
            onChange={(e) => setReporteId(e.target.value)}
            className={inputCls}
          >
            <option value="" disabled>
              Selecciona un reporte…
            </option>
            {reportes.map((r) => (
              <option key={r.id} value={r.id}>
                {limpiar(r.nombre)} · {r.ejercicio}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Título */}
      <div>
        <label htmlFor="titulo" className={labelCls}>
          Título{" "}
          {enunciadoBloqueado && (
            <span className="font-normal text-muted">· bloqueado (tiene evidencia)</span>
          )}
        </label>
        <input
          id="titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          disabled={enunciadoBloqueado}
          required
          placeholder="Enunciado en lenguaje cliente…"
          className={inputCls}
        />
      </div>

      {/* Descripción */}
      <div>
        <label htmlFor="descripcion" className={labelCls}>
          Descripción{" "}
          {enunciadoBloqueado && (
            <span className="font-normal text-muted">· bloqueada (tiene evidencia)</span>
          )}
        </label>
        <textarea
          id="descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          disabled={enunciadoBloqueado}
          rows={3}
          placeholder="Detalle de lo que se solicita…"
          className={areaCls}
        />
      </div>

      {enunciadoBloqueado && (
        <p className="-mt-4 rounded-xl border border-dashed border-gold/40 bg-gold/5 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
          El título y la descripción no pueden cambiar: el cliente ya respondió a
          este enunciado con evidencia. El resto de los campos sí es editable.
        </p>
      )}

      {/* Área + orden */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <AreasSelector
            areas={areasTenant}
            seleccionadas={areasSel}
            onChange={(next) => setAreasSel(modo === "editar" ? next.slice(-1) : next)}
            libre={areaLibre}
            onLibreChange={setAreaLibre}
            disabled={pending}
          />
        </div>
        <div>
          <label htmlFor="orden" className={labelCls}>
            Orden{" "}
            <span className="font-normal text-muted">· opcional</span>
          </label>
          <input
            id="orden"
            type="number"
            min={0}
            step={10}
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            placeholder="Auto (al final)"
            className={inputCls}
          />
        </div>
      </div>

      {/* Cuantitativa + unidad */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <span className={labelCls}>Tipo</span>
          <label className="mt-1.5 flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-crema/40 px-3.5">
            <input
              type="checkbox"
              checked={esCuant}
              onChange={(e) => setEsCuant(e.target.checked)}
              className="size-4 accent-teal"
            />
            <span className="text-sm text-ink">Es cuantitativa (espera un valor)</span>
          </label>
        </div>
        <div>
          <label htmlFor="unidad_esperada" className={labelCls}>
            Unidad esperada
          </label>
          <input
            id="unidad_esperada"
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            disabled={!esCuant}
            placeholder={esCuant ? "kWh, tCO2e, %…" : "Solo si es cuantitativa"}
            className={inputCls}
          />
        </div>
      </div>

      {/* Fecha límite */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="fecha_limite" className={labelCls}>
            Fecha límite
          </label>
          <input
            id="fecha_limite"
            type="date"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Recordatorios automáticos — junto a la fecha límite porque el plazo y el
          aviso del plazo son la misma decisión. */}
      <RecordatoriosSeccion
        fechaLimite={fechaLimite}
        dias={recordatorios}
        onChange={setRecordatorios}
        disabled={pending}
      />

      {/* Rubro clave (discrepancias) */}
      <div>
        <label htmlFor="rubro_clave" className={labelCls}>
          Rubro clave <span className="font-normal text-muted">· opcional</span>
        </label>
        <input
          id="rubro_clave"
          value={rubroClave}
          onChange={(e) => setRubroClave(e.target.value)}
          placeholder="p. ej. consumo_electrico_total"
          className={inputCls}
        />
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Solo si dos áreas capturan el mismo concepto y deben cuadrar: escribe la
          misma etiqueta en ambas solicitudes. Con la misma unidad y periodo,
          valores distintos disparan la alerta de discrepancia. Déjalo vacío si es
          un dato independiente (no participa en discrepancias).
        </p>
      </div>

      {/* Rubro de taxonomía (celda de la plantilla oficial) */}
      <div>
        <label htmlFor="rubro_taxonomia" className={labelCls}>
          Rubro de taxonomía <span className="font-normal text-muted">· opcional</span>
        </label>
        <select
          id="rubro_taxonomia"
          value={difusion ? "" : rubroTaxonomia}
          onChange={(e) => setRubroTaxonomia(e.target.value)}
          disabled={difusion}
          className={inputCls}
        >
          <option value="">Ninguno — no alimenta una celda de la plantilla</option>
          {rubros.map((r) => (
            <option key={r.clave} value={r.clave}>
              {r.grupoLabel} · {r.etiqueta}
            </option>
          ))}
        </select>
        {difusion && (
          <p className="mt-1.5 rounded-xl border border-dashed border-line bg-crema/40 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
            <span className="font-semibold">Una difusión no lleva rubro.</span> La celda
            del entregable la llena <span className="font-medium">una sola</span>{" "}
            solicitud, y varias copias peleándose por ella dejarían el Excel
            indefinido. Cuando sepas qué área tenía la información, asígnale el rubro
            desde el detalle de esa copia.
          </p>
        )}
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Qué celda de la plantilla oficial llena el valor de esta solicitud. Es lo
          que hace que el Excel de taxonomía salga lleno. Un rubro lo alimenta{" "}
          <span className="font-medium text-ink">una sola solicitud por reporte</span>.
          No lo confundas con el <span className="font-medium text-ink">rubro clave</span>{" "}
          de arriba, que solo sirve para cuadrar dos áreas entre sí.
        </p>
      </div>

      {/* Nota de alcance — acompaña al rubro: si esta solicitud llena una celda de
          la plantilla, es aquí donde se declara con qué perímetro debe leerse. */}
      {!soloCliente && (
        <div>
          <label htmlFor="nota_alcance" className={labelCls}>
            Nota de alcance <span className="font-normal text-muted">· opcional</span>
          </label>
          <textarea
            id="nota_alcance"
            value={notaAlcance}
            onChange={(e) => setNotaAlcance(e.target.value)}
            rows={2}
            maxLength={NOTA_ALCANCE_MAX}
            placeholder="Solo si el perímetro del dato no es el que un lector supondría…"
            className={areaCls}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Qué comprende la cifra y qué no, redactado para el entregable. Se agrega a
            la celda de <span className="font-medium text-ink">Notas/Brechas</span> del
            Excel de taxonomía, junto a las brechas que ya haya. Úsala cuando el dato
            cubra menos de lo que su etiqueta sugiere —una división en vez del grupo,
            un semestre en vez del año—; si el perímetro es el obvio, déjala vacía.
          </p>
        </div>
      )}

      {/* Responsables */}
      <div className={soloCliente ? "" : "grid gap-6 sm:grid-cols-2"}>
        <div className={soloCliente ? "sm:w-[calc(50%-0.75rem)]" : ""}>
          <label htmlFor="responsable_cliente_id" className={labelCls}>
            {soloCliente ? "Responsable" : "Responsable cliente"}
          </label>
          <select
            id="responsable_cliente_id"
            value={respCliente}
            onChange={(e) => setRespCliente(e.target.value)}
            className={inputCls}
          >
            <option value="">Sin asignar</option>
            {responsablesCliente.map((u) => (
              <option key={u.id} value={u.id}>
                {limpiar(u.nombre)}
                {u.area ? ` · ${u.area}` : ""}
              </option>
            ))}
          </select>
        </div>
        {!soloCliente && (
          <div>
            <label htmlFor="responsable_irstrat_id" className={labelCls}>
              Responsable IRStrat
            </label>
            <select
              id="responsable_irstrat_id"
              value={respIrstrat}
              onChange={(e) => setRespIrstrat(e.target.value)}
              className={inputCls}
            >
              <option value="">Sin asignar</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {limpiar(s.nombre)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Datapoints — mapeo interno a la norma: solo IRStrat. */}
      {!soloCliente && (
        <div>
          <span className={labelCls}>Mapeo a datapoints (NIIF S1/S2)</span>
          <p className="mb-2 mt-0.5 text-xs text-muted">
            Interno de IRStrat. Busca por código o descripción y liga los datapoints
            que alimenta esta solicitud.
          </p>
          <DatapointSelector
            todos={datapoints}
            seleccionados={datapointIds}
            onChange={setDatapointIds}
          />
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-end gap-2.5 border-t border-line pt-6">
        <Link
          href={cancelar}
          className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
        >
          Cancelar
        </Link>
        <Button type="submit" loading={pending}>
          {modo === "crear" ? "Crear solicitud" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
