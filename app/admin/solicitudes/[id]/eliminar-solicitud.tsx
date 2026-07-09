"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { eliminarSolicitud, type GestionState } from "../gestion-actions";

/**
 * Acción de eliminar una solicitud. Solo se monta cuando es elegible (pendiente
 * y sin evidencia); la autoridad final es el servidor. Confirmación con
 * ConfirmDialog; al eliminar, vuelve a la matriz.
 */
export function EliminarSolicitud({
  solicitudId,
  titulo,
}: {
  solicitudId: string;
  titulo: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmar = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("solicitud_id", solicitudId);
      const r: GestionState = await eliminarSolicitud(
        { ok: false },
        fd
      );
      setAbierto(false);
      if (r.ok) {
        toast.success(r.mensaje ?? "Solicitud eliminada.");
        router.push("/admin");
      } else {
        toast.error(r.error ?? "No se pudo eliminar la solicitud.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-rojo transition duration-150 hover:opacity-80"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
        Eliminar solicitud
      </button>

      <ConfirmDialog
        open={abierto}
        tono="danger"
        titulo="¿Eliminar esta solicitud?"
        descripcion={`Se eliminará “${titulo}”. Solo es posible porque está pendiente y sin evidencia; esta acción no se puede deshacer.`}
        confirmar="Sí, eliminar"
        cancelar="Cancelar"
        cargando={pending}
        onConfirm={confirmar}
        onCancel={() => setAbierto(false)}
      />
    </>
  );
}
