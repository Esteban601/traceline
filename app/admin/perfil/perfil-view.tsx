"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { fmtFechaHora } from "@/lib/fechas";
import {
  MATRIZ_SUGERIDA,
  PLAZOS,
  type EtapaCadena,
  type Hito,
  type Horizonte,
  type MatrizRiesgos,
} from "@/lib/perfil-emisor";
import {
  quitarAdjunto,
  subirAdjunto,
  guardarCarta,
  guardarGobierno,
  guardarHistoria,
  guardarHorizontes,
  guardarIdentidad,
  guardarMaterialidad,
  guardarMatriz,
  guardarModeloNegocio,
  guardarTrayectoria,
  subirOrganigrama,
  type AdjuntoState,
  type PerfilState,
} from "./actions";

// =============================================================================
// Formulario del Perfil del emisor.
//
// Diez secciones plegables, cada una con su propio guardado. La razón de que se
// guarde por partes está en actions.ts; aquí la consecuencia visual es que cada
// sección tiene su botón y su aviso, y que abrir una no obliga a tocar el resto.
//
// LAS LISTAS SE EDITAN COMO FILAS. Hitos, cadena de valor y niveles de la matriz
// viven como jsonb en la base, pero el usuario nunca ve una llave ni una coma:
// ve filas con "Agregar" y "Quitar", y en los hitos también flechas para
// reordenar, porque una línea de tiempo desordenada no se entiende.
// =============================================================================

export type Adjunto = {
  id: string;
  seccion: string;
  nombreOriginal: string;
  tamano: number | null;
  creadoEn: string;
  subidoPor: string | null;
  url: string | null;
};

export type PerfilData = {
  denominacion_formal: string | null;
  nombre_corto: string | null;
  forma_de_referencia: string | null;
  entidad_que_informa: string | null;
  perimetro: string | null;
  carta_texto: string | null;
  carta_firmante: string | null;
  carta_cargo: string | null;
  proceso_materialidad: string | null;
  modelo_negocio: string | null;
  gobierno_texto: string | null;
  organigrama_path: string | null;
  horizontes: Horizonte[];
  hitos_corporativos: Hito[];
  hitos_sostenibilidad: Hito[];
  cadena_valor: EtapaCadena[];
  matriz_riesgos: MatrizRiesgos | null;
  actualizado_en: string | null;
  actualizado_por_nombre: string | null;
};

// `cn` es un join simple, sin tailwind-merge: si la clase base trae `w-full` y
// la fila añade `w-24`, ambas quedan y gana el orden de la hoja de estilos, no
// el de la llamada. Por eso el ancho NO va en la base: `INPUT` lo añade para el
// caso común y las filas usan `INPUT_CAMPO` con su ancho propio.
const INPUT_CAMPO =
  "h-11 rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface";
const INPUT = `${INPUT_CAMPO} w-full`;
const AREA =
  "w-full rounded-xl border border-line bg-crema/40 px-3.5 py-2.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface";
const LABEL = "block text-xs font-medium uppercase tracking-wide text-muted";

/** Cabecera plegable con el estado de la sección. */
function Seccion({
  titulo,
  ayuda,
  completa,
  reciente,
  abierta,
  onToggle,
  children,
}: {
  titulo: string;
  ayuda: string;
  completa: boolean;
  /** Confirmación tras guardar: "hace un momento · por quien fuera". */
  reciente: string | null;
  abierta: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("overflow-hidden", reciente && "border-teal/40")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierta}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-ink/[0.02]"
      >
        <span
          aria-hidden
          className={cn(
            "text-muted transition duration-150",
            abierta ? "rotate-90" : "rotate-0"
          )}
        >
          ›
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold text-ink">{titulo}</span>
          <span className="block text-xs text-muted">{reciente ?? ayuda}</span>
        </span>
        {reciente ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal px-2.5 py-1 text-xs font-medium text-crema">
            <span aria-hidden>✓</span> Actualizada
          </span>
        ) : (
          <Chip tono={completa ? "verde" : "gris"}>{completa ? "Con datos" : "Vacía"}</Chip>
        )}
      </button>
      {abierta && <div className="border-t border-line px-5 py-5">{children}</div>}
    </Card>
  );
}

/** Aviso del resultado de guardar ESA sección. */
function Aviso({ state, seccion }: { state: PerfilState; seccion: string }) {
  if (state.seccion !== seccion) return null;
  if (state.error) return <p className="mt-3 text-sm text-rojo">{state.error}</p>;
  if (state.ok && state.mensaje)
    return <p className="mt-3 text-sm text-teal">{state.mensaje}</p>;
  return null;
}

const VACIO: PerfilState = { ok: false, error: null, mensaje: null, seccion: null };

/**
 * Reacción al resultado de una acción: aviso, y si salió bien, plegar la sección
 * y marcarla como actualizada. Si falla, la sección se queda ABIERTA con el error
 * a la vista — plegar un formulario que no guardó esconde justo lo que hay que
 * corregir.
 */
function useResultado(
  state: PerfilState,
  onOk: (seccion: string, quien: string | null) => void
) {
  const toast = useToast();
  useEffect(() => {
    if (state.seccion == null) return;
    if (state.ok && state.mensaje) {
      toast.success(state.mensaje);
      onOk(state.seccion, state.actualizadoPor ?? null);
    } else if (state.error) {
      toast.error(state.error);
    }
    // El estado de useActionState es una referencia nueva por respuesta, así que
    // esto se dispara una vez por guardado y no en cada render.
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Botón de guardado con progreso. Se deshabilita solo mientras la acción corre. */
function BotonGuardar({ etiqueta = "Guardar sección" }: { etiqueta?: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="mt-5 flex items-center gap-3">
      <Button type="submit" size="sm" loading={pending} disabled={pending}>
        {pending ? "Guardando…" : etiqueta}
      </Button>
      {pending && <span className="text-xs text-muted">Guardando la sección…</span>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Filas editables genéricas (hitos, cadena de valor, niveles)
// -----------------------------------------------------------------------------
function BotonFila({
  children,
  onClick,
  titulo,
}: {
  children: React.ReactNode;
  onClick: () => void;
  titulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:border-teal/40 hover:text-teal"
    >
      {children}
    </button>
  );
}

export function PerfilView({
  tenantId,
  tenantNombre,
  perfil,
  organigramaUrl,
  adjuntos,
  puedeElegirEmisora,
}: {
  tenantId: string;
  tenantNombre: string;
  perfil: PerfilData | null;
  organigramaUrl: string | null;
  adjuntos: Adjunto[];
  puedeElegirEmisora: boolean;
}) {
  const [abierta, setAbierta] = useState<string | null>("identidad");
  const alternar = (k: string) => setAbierta((a) => (a === k ? null : k));

  const p = perfil;
  const uid = useId();

  // Estado local de las listas editables.
  const [hitosCorp, setHitosCorp] = useState<Hito[]>(p?.hitos_corporativos ?? []);
  const [hitosSost, setHitosSost] = useState<Hito[]>(p?.hitos_sostenibilidad ?? []);
  const [cadena, setCadena] = useState<EtapaCadena[]>(p?.cadena_valor ?? []);
  const [niveles, setNiveles] = useState(
    p?.matriz_riesgos?.niveles ?? MATRIZ_SUGERIDA.niveles
  );
  const [escala, setEscala] = useState(
    String(p?.matriz_riesgos?.escala_max ?? MATRIZ_SUGERIDA.escala_max)
  );

  const [sIdent, aIdent] = useActionState(guardarIdentidad, VACIO);
  const [sMatriz, aMatriz] = useActionState(guardarMatriz, VACIO);
  const [sHoriz, aHoriz] = useActionState(guardarHorizontes, VACIO);
  const [sCarta, aCarta] = useActionState(guardarCarta, VACIO);
  const [sHist, aHist] = useActionState(guardarHistoria, VACIO);
  const [sTray, aTray] = useActionState(guardarTrayectoria, VACIO);
  const [sModelo, aModelo] = useActionState(guardarModeloNegocio, VACIO);
  const [sGob, aGob] = useActionState(guardarGobierno, VACIO);
  const [sOrg, aOrg] = useActionState(subirOrganigrama, VACIO);
  const [sMat, aMat] = useActionState(guardarMaterialidad, VACIO);

  // Qué secciones se acaban de guardar, con quién lo hizo. Se pinta en la
  // cabecera hasta que se recargue la página.
  const [recientes, setRecientes] = useState<Record<string, string>>({});
  const marcarOk = (seccion: string, quien: string | null) => {
    setRecientes((r) => ({
      ...r,
      [seccion]: quien ? `Actualizada hace un momento · por ${quien}` : "Actualizada hace un momento",
    }));
    setAbierta((a) => (a === seccion ? null : a));
  };

  // Una llamada por sección, no un bucle: las reglas de hooks exigen que el
  // número y el orden sean fijos entre renders.
  useResultado(sIdent, marcarOk);
  useResultado(sMatriz, marcarOk);
  useResultado(sHoriz, marcarOk);
  useResultado(sCarta, marcarOk);
  useResultado(sHist, marcarOk);
  useResultado(sTray, marcarOk);
  useResultado(sModelo, marcarOk);
  useResultado(sGob, marcarOk);
  useResultado(sOrg, marcarOk);
  useResultado(sMat, marcarOk);

  const hz: Horizonte[] =
    p?.horizontes?.length === 3
      ? p.horizontes
      : PLAZOS.map((plazo) => ({ plazo, definicion: "", justificacion: "" }));

  const oculto = <input type="hidden" name="tenant_id" value={tenantId} />;
  const guardar = (etiqueta = "Guardar sección") => <BotonGuardar etiqueta={etiqueta} />;

  return (
    <div className="space-y-3">
      {!puedeElegirEmisora && (
        <p className="text-sm text-muted">
          Perfil de <span className="font-medium text-ink">{tenantNombre}</span>. Lo que
          escribas aquí alimenta el Suplemento S1 / S2; lo que quede vacío saldrá marcado
          como pendiente, nunca inventado.
        </p>
      )}

      {p?.actualizado_en && (
        <p className="text-xs text-muted">
          Última actualización: {fmtFechaHora(p.actualizado_en)}
          {p.actualizado_por_nombre ? ` · ${p.actualizado_por_nombre}` : ""}
        </p>
      )}

      {/* 1 · IDENTIDAD ---------------------------------------------------- */}
      <Seccion
        titulo="Identidad"
        ayuda="Cómo se llama la entidad y qué comprende lo que informa."
        completa={!!p?.denominacion_formal}
        abierta={abierta === "identidad"}
        onToggle={() => alternar("identidad")}
        reciente={recientes["identidad"] ?? null}
      >
        <form action={aIdent}>
          {oculto}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor={`${uid}-df`}>
                Denominación formal
              </label>
              <input
                id={`${uid}-df`}
                name="denominacion_formal"
                defaultValue={p?.denominacion_formal ?? ""}
                placeholder="Nombre legal completo, como aparece en el acta"
                className={cn(INPUT, "mt-2")}
              />
              <p className="mt-1.5 text-xs text-muted">El nombre con el que la entidad está inscrita. Ejemplo: “Empresa Demo, S.A.B. de C.V.”.</p>
            </div>
            <div>
              <label className={LABEL} htmlFor={`${uid}-nc`}>
                Nombre corto
              </label>
              <input
                id={`${uid}-nc`}
                name="nombre_corto"
                defaultValue={p?.nombre_corto ?? ""}
                placeholder="Como se le conoce"
                className={cn(INPUT, "mt-2")}
              />
              <p className="mt-1.5 text-xs text-muted">El que se usa en el día a día y en los encabezados del documento.</p>
            </div>
            <div>
              <label className={LABEL} htmlFor={`${uid}-fr`}>
                Forma de referencia en el texto
              </label>
              <input
                id={`${uid}-fr`}
                name="forma_de_referencia"
                defaultValue={p?.forma_de_referencia ?? ""}
                placeholder="la Compañía · la Emisora · el Grupo"
                className={cn(INPUT, "mt-2")}
              />
              <p className="mt-1.5 text-xs text-muted">
                Con esto se refiere a ustedes el documento generado.
              </p>
            </div>
            <div>
              <label className={LABEL} htmlFor={`${uid}-ei`}>
                Entidad que informa
              </label>
              <input
                id={`${uid}-ei`}
                name="entidad_que_informa"
                defaultValue={p?.entidad_que_informa ?? ""}
                placeholder="Controladora y subsidiarias, o la sociedad que reporta"
                className={cn(INPUT, "mt-2")}
              />
              <p className="mt-1.5 text-xs text-muted">La entidad cuya información se revela: la controladora sola, o el grupo consolidado.</p>
            </div>
          </div>
          <div className="mt-4">
            <label className={LABEL} htmlFor={`${uid}-pe`}>
              Perímetro del informe
            </label>
            <textarea
              id={`${uid}-pe`}
              name="perimetro"
              rows={3}
              defaultValue={p?.perimetro ?? ""}
              placeholder="Qué queda dentro y qué fuera de la información reportada."
              className={cn(AREA, "mt-2")}
            />
            <p className="mt-1.5 text-xs text-muted">
              Qué entidades, operaciones o ubicaciones cubre este informe y cuáles se
              excluyen. Ejemplo: los desarrollos en coinversión se excluyen de las métricas
              de exposición.
            </p>
          </div>
          {guardar()}
          <Aviso state={sIdent} seccion="identidad" />
        </form>
        <Adjuntos tenantId={tenantId} seccion="identidad" adjuntos={adjuntos} />
      </Seccion>

      {/* 2 · MATRIZ DE RIESGOS -------------------------------------------- */}
      <Seccion
        titulo="Matriz de riesgos"
        ayuda="La escala con la que se prioriza. Sin ella, los registros de clima no muestran nivel."
        completa={!!p?.matriz_riesgos?.niveles?.length}
        abierta={abierta === "matriz"}
        onToggle={() => alternar("matriz")}
        reciente={recientes["matriz"] ?? null}
      >
        <form action={aMatriz}>
          {oculto}
          <div className="sm:max-w-xs">
            <label className={LABEL} htmlFor={`${uid}-esc`}>
              Puntaje máximo de la escala
            </label>
            <input
              id={`${uid}-esc`}
              name="escala_max"
              type="number"
              min={1}
              step="any"
              value={escala}
              onChange={(e) => setEscala(e.target.value)}
              className={cn(INPUT, "mt-2")}
            />
            <p className="mt-1.5 text-xs text-muted">
              Con probabilidad e impacto de 1 a 5, el máximo es 25.
            </p>
          </div>

          <p className={cn(LABEL, "mt-5")}>Niveles</p>
          <p className="mt-1 text-xs text-muted">
            Cada nivel cubre un rango cerrado de puntaje. Los rangos no deben solaparse ni
            dejar huecos: un puntaje fuera de todos ellos se queda sin nivel.
          </p>
          <div className="mt-2 space-y-2">
            {niveles.map((n, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_5.5rem_5.5rem_2rem] items-center gap-2"
              >
                <input
                  name="nivel_nombre"
                  value={n.nombre}
                  onChange={(e) =>
                    setNiveles((v) =>
                      v.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x))
                    )
                  }
                  placeholder="Nombre del nivel"
                  className={cn(INPUT_CAMPO, "w-full")}
                />
                <input
                  name="nivel_min"
                  type="number"
                  step="any"
                  value={n.min}
                  onChange={(e) =>
                    setNiveles((v) =>
                      v.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x))
                    )
                  }
                  placeholder="Mín."
                  className={cn(INPUT_CAMPO, "w-full")}
                />
                <input
                  name="nivel_max"
                  type="number"
                  step="any"
                  value={n.max}
                  onChange={(e) =>
                    setNiveles((v) =>
                      v.map((x, j) => (j === i ? { ...x, max: Number(e.target.value) } : x))
                    )
                  }
                  placeholder="Máx."
                  className={cn(INPUT_CAMPO, "w-full")}
                />
                <BotonFila
                  titulo="Quitar nivel"
                  onClick={() => setNiveles((v) => v.filter((_, j) => j !== i))}
                >
                  ×
                </BotonFila>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setNiveles((v) => [...v, { nombre: "", min: 0, max: 0 }])}
            >
              Agregar nivel
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setNiveles(MATRIZ_SUGERIDA.niveles);
                setEscala(String(MATRIZ_SUGERIDA.escala_max));
              }}
            >
              Usar la sugerida (0–25, cuatro niveles)
            </Button>
          </div>
          {guardar()}
          <Aviso state={sMatriz} seccion="matriz" />
        </form>
        <Adjuntos tenantId={tenantId} seccion="matriz" adjuntos={adjuntos} />
      </Seccion>

      {/* 3 · HORIZONTES ---------------------------------------------------- */}
      <Seccion
        titulo="Horizontes temporales"
        ayuda="NIIF S2 10 pide la definición de cada plazo y por qué se eligió."
        completa={hz.some((h) => h.definicion)}
        abierta={abierta === "horizontes"}
        onToggle={() => alternar("horizontes")}
        reciente={recientes["horizontes"] ?? null}
      >
        <form action={aHoriz}>
          {oculto}
          <div className="space-y-4">
            {hz.map((h, i) => (
              <div key={h.plazo} className="rounded-xl border border-line bg-crema/30 p-4">
                <p className="font-medium text-ink">{h.plazo}</p>
                <p className="mt-0.5 text-xs text-muted">
                  La definición es el rango de años; la justificación, por qué ese corte
                  para esta entidad (ciclo de inversión, vida útil de los activos, plazo de
                  la concesión).
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={LABEL} htmlFor={`${uid}-hd${i}`}>
                      Definición
                    </label>
                    <input
                      id={`${uid}-hd${i}`}
                      name="definicion"
                      defaultValue={h.definicion}
                      placeholder="p. ej. de 0 a 3 años"
                      className={cn(INPUT, "mt-2")}
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor={`${uid}-hj${i}`}>
                      Justificación
                    </label>
                    <input
                      id={`${uid}-hj${i}`}
                      name="justificacion"
                      defaultValue={h.justificacion}
                      placeholder="Por qué ese corte para esta entidad"
                      className={cn(INPUT, "mt-2")}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {guardar()}
          <Aviso state={sHoriz} seccion="horizontes" />
        </form>
        <Adjuntos tenantId={tenantId} seccion="horizontes" adjuntos={adjuntos} />
      </Seccion>

      {/* 4 · CARTA --------------------------------------------------------- */}
      <Seccion
        titulo="Carta de la Dirección"
        ayuda="Abre el suplemento. El generador corrige estilo; no agrega hechos."
        completa={!!p?.carta_texto}
        abierta={abierta === "carta"}
        onToggle={() => alternar("carta")}
        reciente={recientes["carta"] ?? null}
      >
        <form action={aCarta}>
          {oculto}
          <div>
            <label className={LABEL} htmlFor={`${uid}-ct`}>
              Texto
            </label>
            <textarea
              id={`${uid}-ct`}
              name="carta_texto"
              rows={10}
              defaultValue={p?.carta_texto ?? ""}
              placeholder="Mensaje de la Dirección sobre el ejercicio y su enfoque de sostenibilidad."
              className={cn(AREA, "mt-2")}
            />
            <p className="mt-1.5 text-xs text-muted">
              Escríbela como quiere que aparezca. El generador corrige estilo y traduce; no
              agrega hechos ni cifras que no estén aquí.
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor={`${uid}-cf`}>
                Firmante
              </label>
              <input
                id={`${uid}-cf`}
                name="carta_firmante"
                defaultValue={p?.carta_firmante ?? ""}
                className={cn(INPUT, "mt-2")}
              />
              <p className="mt-1.5 text-xs text-muted">Nombre de quien firma la carta.</p>
            </div>
            <div>
              <label className={LABEL} htmlFor={`${uid}-cc`}>
                Cargo
              </label>
              <input
                id={`${uid}-cc`}
                name="carta_cargo"
                defaultValue={p?.carta_cargo ?? ""}
                placeholder="Director General"
                className={cn(INPUT, "mt-2")}
              />
              <p className="mt-1.5 text-xs text-muted">
                Cargo tal como debe imprimirse bajo la firma.
              </p>
            </div>
          </div>
          {guardar()}
          <Aviso state={sCarta} seccion="carta" />
        </form>
        <Adjuntos tenantId={tenantId} seccion="carta" adjuntos={adjuntos} />
      </Seccion>

      {/* 5 y 6 · HITOS ----------------------------------------------------- */}
      {(
        [
          {
            k: "historia",
            titulo: "Historia corporativa",
            ayuda: "Línea de tiempo de la empresa.",
            filas: hitosCorp,
            set: setHitosCorp,
            action: aHist,
            state: sHist,
            completa: hitosCorp.length > 0,
          },
          {
            k: "trayectoria",
            titulo: "Trayectoria en sostenibilidad",
            ayuda: "Hitos de clima y sostenibilidad.",
            filas: hitosSost,
            set: setHitosSost,
            action: aTray,
            state: sTray,
            completa: hitosSost.length > 0,
          },
        ] as const
      ).map((s) => (
        <Seccion
          key={s.k}
          titulo={s.titulo}
          ayuda={s.ayuda}
          completa={s.completa}
          abierta={abierta === s.k}
          onToggle={() => alternar(s.k)}
          reciente={recientes[s.k] ?? null}
        >
          <form action={s.action}>
            {oculto}
            {s.filas.length === 0 && (
              <p className="text-sm text-muted">Sin hitos. Agrega el primero.</p>
            )}
            <div className="space-y-2">
              {s.filas.map((h, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[6rem_1fr_2rem_2rem_2rem] items-center gap-2"
                >
                  <input
                    name="anio"
                    value={h.anio}
                    onChange={(e) =>
                      s.set((v) =>
                        v.map((x, j) => (j === i ? { ...x, anio: e.target.value } : x))
                      )
                    }
                    placeholder="Año"
                    className={cn(INPUT_CAMPO, "w-full")}
                  />
                  <input
                    name="texto"
                    value={h.texto}
                    onChange={(e) =>
                      s.set((v) =>
                        v.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x))
                      )
                    }
                    placeholder="Qué pasó"
                    className={cn(INPUT_CAMPO, "w-full")}
                  />
                  <BotonFila
                    titulo="Subir"
                    onClick={() =>
                      s.set((v) => {
                        if (i === 0) return v;
                        const c = [...v];
                        [c[i - 1], c[i]] = [c[i], c[i - 1]];
                        return c;
                      })
                    }
                  >
                    ↑
                  </BotonFila>
                  <BotonFila
                    titulo="Bajar"
                    onClick={() =>
                      s.set((v) => {
                        if (i === v.length - 1) return v;
                        const c = [...v];
                        [c[i + 1], c[i]] = [c[i], c[i + 1]];
                        return c;
                      })
                    }
                  >
                    ↓
                  </BotonFila>
                  <BotonFila
                    titulo="Quitar"
                    onClick={() => s.set((v) => v.filter((_, j) => j !== i))}
                  >
                    ×
                  </BotonFila>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => s.set((v) => [...v, { anio: "", texto: "" }])}
              >
                Agregar hito
              </Button>
            </div>
            {guardar()}
            <Aviso state={s.state} seccion={s.k} />
          </form>
          <Adjuntos tenantId={tenantId} seccion={s.k} adjuntos={adjuntos} />
      </Seccion>
      ))}

      {/* 7 · MODELO DE NEGOCIO Y CADENA DE VALOR ---------------------------- */}
      <Seccion
        titulo="Modelo de negocio y cadena de valor"
        ayuda="Qué hace la entidad y por qué etapas pasa lo que hace."
        completa={!!p?.modelo_negocio || cadena.length > 0}
        abierta={abierta === "modelo"}
        onToggle={() => alternar("modelo")}
        reciente={recientes["modelo"] ?? null}
      >
        <form action={aModelo}>
          {oculto}
          <div>
            <label className={LABEL} htmlFor={`${uid}-mn`}>
              Modelo de negocio
            </label>
            <textarea
              id={`${uid}-mn`}
              name="modelo_negocio"
              rows={6}
              defaultValue={p?.modelo_negocio ?? ""}
              placeholder="Cómo genera valor la entidad."
              className={cn(AREA, "mt-2")}
            />
            <p className="mt-1.5 text-xs text-muted">
              A qué se dedica, con qué activos y para quién. Es la base del bloque sobre
              efectos del clima en el modelo de negocio.
            </p>
          </div>

          <p className={cn(LABEL, "mt-5")}>Cadena de valor</p>
          <p className="mt-1 text-xs text-muted">
            Las etapas por las que pasa lo que la entidad produce o presta, de principio a
            fin. Se usan para situar dónde ocurre cada riesgo.
          </p>
          {cadena.length === 0 && (
            <p className="mt-2 text-sm text-muted">Sin etapas. Agrega la primera.</p>
          )}
          <div className="mt-2 space-y-2">
            {cadena.map((c, i) => (
              <div
                key={i}
                className="grid grid-cols-[12rem_1fr_2rem_2rem_2rem] items-center gap-2"
              >
                <input
                  name="etapa"
                  value={c.etapa}
                  onChange={(e) =>
                    setCadena((v) =>
                      v.map((x, j) => (j === i ? { ...x, etapa: e.target.value } : x))
                    )
                  }
                  placeholder="Etapa"
                  className={cn(INPUT_CAMPO, "w-full")}
                />
                <input
                  name="descripcion"
                  value={c.descripcion}
                  onChange={(e) =>
                    setCadena((v) =>
                      v.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x))
                    )
                  }
                  placeholder="Qué ocurre en ella"
                  className={cn(INPUT_CAMPO, "w-full")}
                />
                <BotonFila
                  titulo="Subir"
                  onClick={() =>
                    setCadena((v) => {
                      if (i === 0) return v;
                      const x = [...v];
                      [x[i - 1], x[i]] = [x[i], x[i - 1]];
                      return x;
                    })
                  }
                >
                  ↑
                </BotonFila>
                <BotonFila
                  titulo="Bajar"
                  onClick={() =>
                    setCadena((v) => {
                      if (i === v.length - 1) return v;
                      const x = [...v];
                      [x[i + 1], x[i]] = [x[i], x[i + 1]];
                      return x;
                    })
                  }
                >
                  ↓
                </BotonFila>
                <BotonFila
                  titulo="Quitar"
                  onClick={() => setCadena((v) => v.filter((_, j) => j !== i))}
                >
                  ×
                </BotonFila>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCadena((v) => [...v, { etapa: "", descripcion: "" }])}
            >
              Agregar etapa
            </Button>
          </div>
          {guardar()}
          <Aviso state={sModelo} seccion="modelo" />
        </form>
        <Adjuntos tenantId={tenantId} seccion="modelo" adjuntos={adjuntos} />
      </Seccion>

      {/* 8 · GOBIERNO Y ORGANIGRAMA ---------------------------------------- */}
      <Seccion
        titulo="Gobierno corporativo"
        ayuda="Estructura de gobierno y su organigrama."
        completa={!!p?.gobierno_texto || !!p?.organigrama_path}
        abierta={abierta === "gobierno"}
        onToggle={() => alternar("gobierno")}
        reciente={recientes["gobierno"] ?? null}
      >
        <form action={aGob}>
          {oculto}
          <div>
            <label className={LABEL} htmlFor={`${uid}-gt`}>
              Estructura de gobierno
            </label>
            <textarea
              id={`${uid}-gt`}
              name="gobierno_texto"
              rows={6}
              defaultValue={p?.gobierno_texto ?? ""}
              placeholder="Órganos, comités y a quién reporta la función de sostenibilidad."
              className={cn(AREA, "mt-2")}
            />
            <p className="mt-1.5 text-xs text-muted">
              Consejo, comités y de quién depende la función de sostenibilidad. NIIF S2 6
              pide saber quién supervisa y con qué frecuencia.
            </p>
          </div>
          {guardar()}
          <Aviso state={sGob} seccion="gobierno" />
        </form>

        <div className="mt-6 border-t border-line pt-5">
          <p className={LABEL}>Organigrama</p>
          {organigramaUrl ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-line bg-crema/30 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={organigramaUrl}
                alt="Organigrama de la entidad"
                className="mx-auto max-h-72 w-auto object-contain"
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Sin organigrama cargado.</p>
          )}
          <form action={aOrg} className="mt-3 flex flex-wrap items-center gap-3">
            {oculto}
            <input
              type="file"
              name="organigrama"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:text-ink"
            />
            <Button type="submit" size="sm" variant="secondary">
              Subir organigrama
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted">
            PNG, JPG, WebP o SVG, hasta 5 MB. Se guarda en el almacenamiento privado de la
            emisora; no queda accesible por URL pública.
          </p>
          <Aviso state={sOrg} seccion="gobierno" />
        </div>
        <Adjuntos tenantId={tenantId} seccion="gobierno" adjuntos={adjuntos} />
      </Seccion>

      {/* 9 · MATERIALIDAD --------------------------------------------------- */}
      <Seccion
        titulo="Proceso de materialidad"
        ayuda="Cómo se determinó qué temas son materiales."
        completa={!!p?.proceso_materialidad}
        abierta={abierta === "materialidad"}
        onToggle={() => alternar("materialidad")}
        reciente={recientes["materialidad"] ?? null}
      >
        <form action={aMat}>
          {oculto}
          <textarea
            name="proceso_materialidad"
            rows={7}
            defaultValue={p?.proceso_materialidad ?? ""}
            placeholder="Metodología, participantes y criterios con los que se priorizaron los temas."
            className={AREA}
          />
          <p className="mt-1.5 text-xs text-muted">
            Cómo se decidió qué temas son materiales: metodología, a quién se consultó y con
            qué criterios se priorizaron.
          </p>
          {guardar()}
          <Aviso state={sMat} seccion="materialidad" />
        </form>
        <Adjuntos tenantId={tenantId} seccion="materialidad" adjuntos={adjuntos} />
      </Seccion>

      <p className="pt-2 text-xs text-muted">
        ¿Faltan datos de clima?{" "}
        <Link href="/admin/registros" className="text-teal underline-offset-2 hover:underline">
          Riesgos y oportunidades climáticos
        </Link>
        .
      </p>
    </div>
  );
}

const VACIO_ADJ: AdjuntoState = { ok: false, error: null, mensaje: null, seccion: null };

const KB = 1024;
function tamano(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < KB) return `${bytes} B`;
  if (bytes < KB * KB) return `${Math.round(bytes / KB)} kB`;
  return `${(bytes / (KB * KB)).toFixed(1)} MB`;
}

/**
 * Archivos de respaldo de una sección.
 *
 * En esta fase se guardan, se descargan y se quitan: el generador NO los lee. Se
 * dice en la propia pantalla para que nadie suba el estudio de materialidad
 * creyendo que con eso el bloque se escribe solo.
 */
function Adjuntos({
  tenantId,
  seccion,
  adjuntos,
}: {
  tenantId: string;
  seccion: string;
  adjuntos: Adjunto[];
}) {
  const [sSubir, aSubir] = useActionState(subirAdjunto, VACIO_ADJ);
  const [sQuitar, aQuitar] = useActionState(quitarAdjunto, VACIO_ADJ);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sSubir.seccion !== seccion) return;
    if (sSubir.ok && sSubir.mensaje) {
      toast.success(sSubir.mensaje);
      if (fileRef.current) fileRef.current.value = "";
    } else if (sSubir.error) toast.error(sSubir.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sSubir]);

  useEffect(() => {
    if (sQuitar.seccion !== seccion) return;
    if (sQuitar.ok && sQuitar.mensaje) toast.success(sQuitar.mensaje);
    else if (sQuitar.error) toast.error(sQuitar.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sQuitar]);

  const mios = adjuntos.filter((a) => a.seccion === seccion);

  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className={LABEL}>Archivos de respaldo</p>
      <p className="mt-1 text-xs text-muted">
        PDF, DOCX, XLSX, PNG o JPG, hasta 20 MB. Quedan guardados con la sección para
        quien la revise; el generador todavía no los lee.
      </p>

      {mios.length > 0 && (
        <ul className="mt-3 space-y-2">
          {mios.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-crema/30 px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm text-teal underline-offset-2 hover:underline"
                  >
                    {a.nombreOriginal}
                  </a>
                ) : (
                  <span className="block truncate text-sm text-ink">{a.nombreOriginal}</span>
                )}
                <span className="block text-xs text-muted">
                  {tamano(a.tamano)}
                  {a.subidoPor ? ` · ${a.subidoPor}` : ""} · {fmtFechaHora(a.creadoEn)}
                </span>
              </span>
              <form action={aQuitar}>
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="seccion" value={seccion} />
                <input type="hidden" name="adjunto_id" value={a.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Quitar
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={aSubir} className="mt-3 flex flex-wrap items-center gap-3">
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="hidden" name="seccion" value={seccion} />
        <input
          ref={fileRef}
          type="file"
          name="archivo"
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg"
          className="text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:text-ink"
        />
        <BotonGuardar etiqueta="Adjuntar" />
      </form>
    </div>
  );
}
