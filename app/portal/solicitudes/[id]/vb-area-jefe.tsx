"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { darVistoBuenoArea, retirarVistoBuenoArea } from "./vb-actions";

// =============================================================================
// El acto del JEFE DE ÁREA en su portal: dar o retirar el visto bueno del área.
//
// Va con ConfirmDialog porque es una FIRMA: queda con su nombre en el expediente
// y la lee después quien valida. No es un guardado más.
//
// Solo se monta cuando la sesión es del jefe de esa área (la página lo decide con
// `lib/vb-area.ts`, y la base lo vuelve a exigir en el trigger).
// =============================================================================

export function VBAreaJefe({
  solicitudId,
  firmado,
  puedeFirmar,
  puedeRetirar,
  motivo,
}: {
  solicitudId: string;
  firmado: boolean;
  puedeFirmar: boolean;
  puedeRetirar: boolean;
  /** Por qué no se puede firmar todavía (sin evidencia, ya validada…). */
  motivo: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirmando, setConfirmando] = useState<"dar" | "retirar" | null>(null);
  const [pending, setPending] = useState(false);

  const ejecutar = (accion: "dar" | "retirar") => {
    setPending(true);
    startTransition(async () => {
      const r =
        accion === "dar"
          ? await darVistoBuenoArea(solicitudId)
          : await retirarVistoBuenoArea(solicitudId);
      setPending(false);
      setConfirmando(null);
      if (r.ok) {
        toast.success(r.mensaje ?? "Listo.");
        router.refresh();
      } else {
        toast.error(r.error ?? "No se pudo registrar el visto bueno del área.");
      }
    });
  };

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold text-ink">
        {firmado ? "Diste el visto bueno del área" : "Visto bueno del área"}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {firmado
          ? "Tu firma queda en el expediente y la ve quien valida. Si llega una entrega nueva, el visto bueno se retira solo: el archivo que respaldaste ya no sería el vigente."
          : "Como jefe del área, confirmas que lo entregado es lo que el área quiere reportar. No sustituye la validación final; la acompaña."}
      </p>

      <div className="mt-4">
        {puedeFirmar && (
          <Button onClick={() => setConfirmando("dar")} loading={pending}>
            Dar visto bueno
          </Button>
        )}
        {puedeRetirar && (
          <Button
            variant="secondary"
            onClick={() => setConfirmando("retirar")}
            loading={pending}
          >
            Retirar visto bueno
          </Button>
        )}
        {!puedeFirmar && !puedeRetirar && motivo && (
          <p className="rounded-xl border border-dashed border-line bg-crema/30 px-3.5 py-3 text-sm text-muted">
            {motivo}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmando === "dar"}
        titulo="¿Dar el visto bueno del área?"
        descripcion="Queda registrado con tu nombre y la fecha, y lo verá quien valide. Si tu equipo carga una versión nueva, el visto bueno se retirará automáticamente."
        confirmar="Dar visto bueno"
        cargando={pending}
        onConfirm={() => ejecutar("dar")}
        onCancel={() => setConfirmando(null)}
      />
      <ConfirmDialog
        open={confirmando === "retirar"}
        titulo="¿Retirar el visto bueno?"
        descripcion="La solicitud vuelve a quedar sin respaldo del área. El retiro también queda en la bitácora."
        confirmar="Retirar"
        tono="danger"
        cargando={pending}
        onConfirm={() => ejecutar("retirar")}
        onCancel={() => setConfirmando(null)}
      />
    </div>
  );
}
