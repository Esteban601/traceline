"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { NOTA_DECLINAR_MAX } from "@/lib/difusion";
import { declinarSolicitud, retomarSolicitud } from "./difusion-actions";

// =============================================================================
// "No aplica a mi área" — el acto del área cuando la pregunta se difundió a varias
// y esta no es la que tiene la información.
//
// Con ConfirmDialog y nota opcional porque no es un descarte: es una DECLARACIÓN
// que se publica en la conversación con el nombre de quien la hizo, y que quien
// difundió va a leer para saber dónde buscar. La nota es el lugar de "esto lo
// tiene Operaciones", que es justo lo que ahorra la siguiente vuelta.
// =============================================================================

export function NoAplica({
  solicitudId,
  declinada,
  puedeDeclinar,
  puedeRetomar,
  motivo,
}: {
  solicitudId: string;
  declinada: boolean;
  puedeDeclinar: boolean;
  puedeRetomar: boolean;
  /** Por qué no se ofrece (ya entregó, expediente cerrado, copia retirada). */
  motivo: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [abierto, setAbierto] = useState<"declinar" | "retomar" | null>(null);
  const [nota, setNota] = useState("");
  const [pending, setPending] = useState(false);

  const ejecutar = (accion: "declinar" | "retomar") => {
    setPending(true);
    startTransition(async () => {
      const r =
        accion === "declinar"
          ? await declinarSolicitud(solicitudId, nota)
          : await retomarSolicitud(solicitudId);
      setPending(false);
      setAbierto(null);
      if (r.ok) {
        setNota("");
        toast.success(r.mensaje ?? "Listo.");
        router.refresh();
      } else {
        toast.error(r.error ?? "No se pudo registrar.");
      }
    });
  };

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold text-ink">
        {declinada ? "Declaraste que no te corresponde" : "¿Esta información es de tu área?"}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {declinada
          ? "Quedó registrado en la conversación y esta solicitud salió de tus pendientes. Si te corresponde después de todo, puedes retomarla."
          : "Se preguntó a varias áreas porque no sabíamos cuál tiene el dato. Si no es tu área, dilo aquí: queda constancia y sale de tus pendientes."}
      </p>

      <div className="mt-4">
        {puedeDeclinar && (
          <Button variant="secondary" onClick={() => setAbierto("declinar")} loading={pending}>
            No aplica a mi área
          </Button>
        )}
        {puedeRetomar && (
          <Button onClick={() => setAbierto("retomar")} loading={pending}>
            Retomar
          </Button>
        )}
        {!puedeDeclinar && !puedeRetomar && motivo && (
          <p className="rounded-xl border border-dashed border-line bg-crema/30 px-3.5 py-3 text-sm text-muted">
            {motivo}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={abierto === "declinar"}
        titulo="¿La información no es de tu área?"
        descripcion="Se publicará en la conversación con tu nombre y la solicitud saldrá de tus pendientes y de tus recordatorios. Es reversible."
        confirmar="Sí, no nos corresponde"
        cargando={pending}
        onConfirm={() => ejecutar("declinar")}
        onCancel={() => setAbierto(null)}
      >
        <label htmlFor="nota-declinar" className="block text-sm font-medium text-ink">
          ¿Sabes quién la tiene? <span className="font-normal text-muted">· opcional</span>
        </label>
        <textarea
          id="nota-declinar"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          maxLength={NOTA_DECLINAR_MAX}
          placeholder="Ej. Este dato lo lleva Operaciones, con el corporativo."
          className="mt-1.5 w-full resize-y rounded-xl border border-line bg-crema/40 px-3.5 py-2.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface"
        />
        <p className="mt-1 text-xs text-muted">
          Se agrega a la declaración. Ahorra la siguiente vuelta de correos.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={abierto === "retomar"}
        titulo="¿Retomar esta solicitud?"
        descripcion="Vuelve a tus pendientes y a tus recordatorios, y queda constancia en la conversación."
        confirmar="Retomar"
        cargando={pending}
        onConfirm={() => ejecutar("retomar")}
        onCancel={() => setAbierto(null)}
      />
    </div>
  );
}
