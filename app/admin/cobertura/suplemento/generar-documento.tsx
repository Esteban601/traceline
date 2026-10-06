"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

// =============================================================================
// ORQUESTACIÓN DEL DOCUMENTO COMPLETO, desde el navegador.
//
// El servidor no encadena los cuarenta bloques: el router de Heroku corta a los
// 30 s y un documento son minutos. Cada bloque es su propia petición, y quien
// lleva la cuenta es esta pantalla.
//
// TRES DECISIONES QUE NO SON ARBITRARIAS:
//
//  · EL 29 VA PRIMERO Y SOLO. Su capa estable —reglas, ejemplo de estilo, índice
//    de los 40, la emisora— es la que comparten todos, así que generarlo antes
//    deja el caché caliente y los 30 siguientes lo leen en vez de escribirlo.
//    Lanzarlos en paralelo desde frío haría que tres pagaran la escritura.
//
//  · CONCURRENCIA 3. Más no acelera: el cuello es el modelo, no la red, y
//    subirla multiplica los reintentos por límite de tasa.
//
//  · UN REINTENTO POR BLOQUE. Un fallo de generación suele ser del modelo, no de
//    los datos, y repetir una vez lo resuelve. Reintentar en bucle gastaría
//    dinero en un bloque que no va a salir.
//
// Si alguien cierra la pestaña, lo generado queda: cada bloque se persiste al
// terminar. Al volver a entrar, la vista de revisión muestra lo que hay.
// =============================================================================

const CONCURRENCIA = 3;
const INTERVALO_MS = 2000;
const LIMITE_MS = 3 * 60 * 1000;

type Estado = "listo" | "abriendo" | "generando" | "hecho" | "error";

export function GenerarDocumento({ reporteId }: { reporteId: string }) {
  const [estado, setEstado] = useState<Estado>("listo");
  const [total, setTotal] = useState(0);
  const [hechos, setHechos] = useState(0);
  const [fallidos, setFallidos] = useState<number[]>([]);
  const [enCurso, setEnCurso] = useState<number[]>([]);
  const [documentoId, setDocumentoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelado = useRef(false);
  const toast = useToast();
  const router = useRouter();

  /** Dispara un bloque y espera a que deje de estar 'generando'. */
  const generarUno = useCallback(async (docId: string, n: number): Promise<boolean> => {
    setEnCurso((x) => [...x, n]);
    try {
      const res = await fetch(`/api/suplemento/${docId}/bloque/${n}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      // 202 = reservado y generándose. 409 = alguien más lo tomó; se consulta igual.
      if (res.status !== 202 && res.status !== 409) return false;

      const hasta = Date.now() + LIMITE_MS;
      while (Date.now() < hasta) {
        if (cancelado.current) return false;
        await new Promise((r) => setTimeout(r, INTERVALO_MS));
        const c = await fetch(`/api/suplemento/${docId}/bloque/${n}`);
        if (!c.ok) continue;
        const b = (await c.json()) as { estado: string };
        if (b.estado === "generando") continue;
        return ["borrador", "no_aplica", "pendiente_adjunto"].includes(b.estado);
      }
      return false;
    } catch {
      return false;
    } finally {
      setEnCurso((x) => x.filter((v) => v !== n));
      setHechos((h) => h + 1);
    }
  }, []);

  /** Cola con concurrencia fija. */
  const enCola = useCallback(
    async (docId: string, numeros: number[]): Promise<number[]> => {
      const fallidos: number[] = [];
      const pendientes = [...numeros];
      const obreros = Array.from({ length: Math.min(CONCURRENCIA, pendientes.length) }, async () => {
        for (;;) {
          const n = pendientes.shift();
          if (n === undefined || cancelado.current) return;
          const ok = await generarUno(docId, n);
          if (!ok) fallidos.push(n);
        }
      });
      await Promise.all(obreros);
      return fallidos;
    },
    [generarUno]
  );

  const generar = useCallback(async () => {
    cancelado.current = false;
    setEstado("abriendo");
    setError(null);
    setHechos(0);
    setFallidos([]);

    try {
      const res = await fetch(`/api/suplemento/${reporteId}/generar`, { method: "POST" });
      const abierto = await res.json();
      if (!res.ok) throw new Error(abierto.error ?? `HTTP ${res.status}`);

      const docId: string = abierto.documentoId;
      const porGenerar: number[] = abierto.porGenerar;
      setDocumentoId(docId);
      setTotal(porGenerar.length);
      setEstado("generando");

      // 1 · El 29 solo, para calentar el caché.
      const primero: number | undefined = abierto.primero;
      const resto = porGenerar.filter((n) => n !== primero);
      const fallos: number[] = [];
      if (primero !== undefined) {
        const ok = await generarUno(docId, primero);
        if (!ok) fallos.push(primero);
      }

      // 2 · El resto, de tres en tres.
      fallos.push(...(await enCola(docId, resto)));

      // 3 · Un reintento a los que fallaron.
      let quedan: number[] = [];
      if (fallos.length && !cancelado.current) {
        toast.success(`Reintentando ${fallos.length} bloque(s).`);
        setHechos((h) => h - fallos.length);
        quedan = await enCola(docId, fallos);
      }

      setFallidos(quedan);
      setEstado(quedan.length ? "error" : "hecho");
      if (quedan.length === 0) toast.success("Documento generado.");
      else toast.error(`${quedan.length} bloque(s) no se pudieron generar.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEstado("error");
    }
  }, [reporteId, generarUno, enCola, toast, router]);

  const pct = total ? Math.round((hechos / total) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={generar} loading={estado === "abriendo" || estado === "generando"} disabled={estado === "generando"}>
        {estado === "generando" ? `Generando ${hechos}/${total}…` : "Generar suplemento"}
      </Button>

      {estado === "generando" && (
        <>
          <span className="h-1.5 w-40 overflow-hidden rounded-full bg-ink/10">
            <span className="block h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-xs text-muted">
            {enCurso.length ? `en curso: ${enCurso.join(", ")}` : "…"}
          </span>
        </>
      )}

      {documentoId && estado !== "generando" && (
        <a
          href={`/admin/cobertura/suplemento/${documentoId}`}
          className={cn("text-sm font-medium text-teal hover:underline")}
        >
          Ver el documento →
        </a>
      )}

      {error && <span className="text-sm text-rojo">{error}</span>}
      {fallidos.length > 0 && (
        <span className="text-sm text-muted">No salieron: {fallidos.join(", ")}. Reintenta desde la revisión.</span>
      )}
    </div>
  );
}
