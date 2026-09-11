"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

// =============================================================================
// BOTÓN DE PRUEBA DEL GENERADOR — solo staff, solo con SUPLEMENTO_PRUEBA=1.
//
// Cada clic GASTA DINERO REAL contra la API de Claude, así que el botón dice
// cuánto costó la última vez y no se esconde detrás de un icono.
//
// Habla con la ruta real, con su flujo asíncrono: POST que responde 202 y
// consulta cada dos segundos. No es una maqueta del flujo, es el flujo.
// =============================================================================

const INTERVALO_MS = 2000;
/** El servidor vence a los 3 min; se deja un poco más antes de rendirse. */
const MAXIMO_CONSULTAS = 110;

type Bloque = {
  numero: number;
  titulo: string;
  estado: string;
  texto: string | null;
  fuentes: { id: string; tipo: string; detalle: string }[];
  pendientes: { campo: string; motivo: string }[];
  modelo: string | null;
  prompt_version: string | null;
  tokens_entrada: number;
  tokens_entrada_cache_escritura: number;
  tokens_entrada_cache_lectura: number;
  tokens_salida: number;
  costo_usd: number | string;
  duracion_ms: number | null;
  motivo?: string;
};

export function GenerarPrueba({ reporteId }: { reporteId: string }) {
  const [estado, setEstado] = useState<"listo" | "generando" | "hecho" | "error">("listo");
  const [bloque, setBloque] = useState<Bloque | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);
  const cancelado = useRef(false);

  useEffect(() => () => { cancelado.current = true; }, []);

  const generar = useCallback(async () => {
    setEstado("generando");
    setError(null);
    setBloque(null);
    setSegundos(0);
    cancelado.current = false;
    const t0 = Date.now();
    const reloj = setInterval(() => setSegundos(Math.round((Date.now() - t0) / 1000)), 1000);

    try {
      const res = await fetch(`/api/suplemento/${reporteId}/bloque/29`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const arranque = await res.json();
      if (res.status !== 202) throw new Error(arranque.error ?? `HTTP ${res.status}`);

      // Consulta cada dos segundos hasta que el estado deje de ser 'generando'.
      for (let i = 0; i < MAXIMO_CONSULTAS; i++) {
        if (cancelado.current) return;
        await new Promise((r) => setTimeout(r, INTERVALO_MS));
        const c = await fetch(`/api/suplemento/${arranque.documentoId}/bloque/29`);
        if (!c.ok) continue;
        const b: Bloque = await c.json();
        if (b.estado === "generando") continue;
        setBloque(b);
        setEstado(b.estado === "error" ? "error" : "hecho");
        if (b.estado === "error") setError(b.motivo ?? "La generación falló.");
        return;
      }
      throw new Error("El bloque no terminó a tiempo.");
    } catch (e) {
      if (cancelado.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setEstado("error");
    } finally {
      clearInterval(reloj);
    }
  }, [reporteId]);

  const notas = (bloque?.pendientes ?? []).filter((p) => p.campo === "nota_revision");
  const huecos = (bloque?.pendientes ?? []).filter((p) => p.campo !== "nota_revision");

  return (
    <Card className="border-dorado/30 bg-dorado/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold-dark">
            Prueba del generador · solo en desarrollo
          </p>
          <p className="mt-1 text-sm text-muted">
            Redacta el bloque 29 con los datos reales de este reporte.{" "}
            <strong className="font-medium text-ink">Cada generación cuesta dinero</strong> y queda
            registrada con su costo en la bitácora.
          </p>
        </div>
        <Button onClick={generar} loading={estado === "generando"} disabled={estado === "generando"}>
          {estado === "generando" ? `Generando… ${segundos} s` : "Generar bloque 29 (prueba)"}
        </Button>
      </div>

      {estado === "generando" && (
        <p className="mt-4 text-sm text-muted">
          La petición respondió de inmediato y el bloque se redacta en segundo plano; esta pantalla
          consulta cada dos segundos. Suele tardar unos 30 segundos. Puedes irte: lo generado queda.
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-rojo/30 bg-rojo/10 px-4 py-3 text-sm text-ink">
          <strong className="font-semibold">No se generó.</strong> {error}
        </div>
      )}

      {bloque && estado === "hecho" && (
        <div className="mt-5 space-y-5 border-t border-line pt-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Chip tono="verde">{bloque.modelo}</Chip>
            <Chip tono="gris">{bloque.prompt_version}</Chip>
            <span>
              entrada {bloque.tokens_entrada.toLocaleString("es-MX")} · caché escrito{" "}
              {bloque.tokens_entrada_cache_escritura.toLocaleString("es-MX")} · caché leído{" "}
              {bloque.tokens_entrada_cache_lectura.toLocaleString("es-MX")} · salida{" "}
              {bloque.tokens_salida.toLocaleString("es-MX")}
            </span>
            <span className="font-medium text-ink">
              ${Number(bloque.costo_usd).toFixed(4)}
            </span>
            <span>{((bloque.duracion_ms ?? 0) / 1000).toFixed(1)} s</span>
          </div>

          <Texto texto={bloque.texto ?? ""} />

          <Lista titulo="Fuentes" vacío="Ninguna.">
            {bloque.fuentes.map((f) => (
              <li key={f.id} className="text-sm text-ink">
                <code className="text-xs text-teal">{f.id}</code>
                <span className="text-muted"> — {f.detalle}</span>
              </li>
            ))}
          </Lista>

          <Lista titulo="Pendientes" vacío="Ninguno.">
            {huecos.map((p, i) => (
              <li key={i} className="text-sm text-ink">
                {p.motivo}
              </li>
            ))}
          </Lista>

          <Lista
            titulo="Notas para el revisor"
            ayuda="No se publican. Son los juicios que el redactor no resuelve."
            vacío="Ninguna."
          >
            {notas.map((p, i) => (
              <li key={i} className="text-sm leading-relaxed text-ink">
                {p.motivo}
              </li>
            ))}
          </Lista>
        </div>
      )}
    </Card>
  );
}

/**
 * El texto llega con la tabla en markdown delante. Se pinta como tabla de
 * verdad: verla en crudo obligaría a leer tuberías para revisar un entregable.
 */
function Texto({ texto }: { texto: string }) {
  const bloques = texto.split("\n\n");
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface px-5 py-4">
      {bloques.map((b, i) => {
        const lineas = b.split("\n");
        if (lineas.some((l) => l.trim().startsWith("|"))) {
          const filas = lineas.filter((l) => l.trim().startsWith("|") && !/^\|[\s|:-]+\|$/.test(l.trim()));
          const celdas = filas.map((f) => f.split("|").slice(1, -1).map((c) => c.trim()));
          const titulo = lineas.find((l) => !l.trim().startsWith("|"));
          return (
            <div key={i} className="overflow-x-auto">
              {titulo && (
                <p className="mb-2 text-sm font-medium text-ink">{titulo.replace(/\*\*/g, "")}</p>
              )}
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {celdas.map((fila, j) => (
                    <tr key={j} className={cn(j === 0 && "border-b border-line")}>
                      {fila.map((c, k) => (
                        <td
                          key={k}
                          className={cn(
                            "px-3 py-1.5",
                            j === 0 ? "font-medium text-muted" : "text-ink",
                            k > 0 && "text-right tabular-nums"
                          )}
                        >
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        // Un párrafo que es solo un **título** en negrita —el encabezado de la
        // tabla— se pinta como tal en vez de enseñar los asteriscos.
        const soloNegrita = /^\*\*(.+)\*\*$/.exec(b.trim());
        if (soloNegrita) {
          return (
            <p key={i} className="text-sm font-medium text-ink">
              {soloNegrita[1]}
            </p>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-ink">
            {b}
          </p>
        );
      })}
    </div>
  );
}

function Lista({
  titulo,
  ayuda,
  vacío,
  children,
}: {
  titulo: string;
  ayuda?: string;
  vacío: string;
  children: React.ReactNode;
}) {
  const vacia = !Array.isArray(children) || children.length === 0;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{titulo}</p>
      {ayuda && <p className="mt-0.5 text-xs text-muted">{ayuda}</p>}
      {vacia ? (
        <p className="mt-1.5 text-sm text-muted">{vacío}</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">{children}</ul>
      )}
    </div>
  );
}
