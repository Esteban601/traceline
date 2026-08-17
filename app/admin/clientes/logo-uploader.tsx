"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  LOGO_ACCEPT,
  LOGO_MAX_ANCHO,
  LOGO_MAX_BYTES,
  esMimeLogoValido,
  esRaster,
  limpiarNombreTenant,
} from "@/lib/tenants";
import { subirLogo, quitarLogo, type LogoState } from "./actions";

const initial: LogoState = { ok: false, error: null };

/**
 * Reduce un logo rasterizado a `LOGO_MAX_ANCHO` de ancho y lo reencoda a WebP
 * (conserva transparencia y pesa menos). Se hace en el navegador a propósito:
 * evita meter una dependencia nativa de imagen (sharp) al servidor justo antes
 * del congelamiento, y el servidor igual revalida tipo y peso, que es lo que no
 * se le puede confiar al cliente. Los SVG no se tocan: son vectores.
 */
async function optimizarRaster(archivo: File): Promise<File> {
  if (!esRaster(archivo.type)) return archivo;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo);
  } catch {
    return archivo; // formato que el navegador no decodifica: que decida el servidor
  }

  if (bitmap.width <= LOGO_MAX_ANCHO) {
    bitmap.close();
    return archivo;
  }

  const ancho = LOGO_MAX_ANCHO;
  const alto = Math.max(1, Math.round((bitmap.height * ancho) / bitmap.width));
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return archivo;
  }
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    lienzo.toBlob(resolve, "image/webp", 0.92)
  );
  if (!blob) return archivo;

  const base = archivo.name.replace(/\.[^.]+$/, "") || "logo";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}

export function LogoUploader({
  tenantId,
  nombre,
  logoUrl,
}: {
  tenantId: string;
  nombre: string;
  logoUrl: string | null;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch, subiendo] = useActionState(subirLogo, initial);
  const [quitando, startQuitar] = useTransition();
  const [preparando, setPreparando] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  useEffect(() => {
    if (state.ok) toast.success(state.mensaje ?? "Logo actualizado.");
    else if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const elegir = () => inputRef.current?.click();

  const onArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    if (!esMimeLogoValido(archivo.type)) {
      toast.error("Formato no admitido. Usa PNG, JPG, SVG o WebP.");
      return;
    }

    setPreparando(true);
    let listo = archivo;
    try {
      listo = await optimizarRaster(archivo);
    } catch {
      listo = archivo;
    }
    setPreparando(false);

    if (listo.size > LOGO_MAX_BYTES) {
      toast.error("El logo no puede pesar más de 2 MB, ni siquiera optimizado.");
      return;
    }

    const fd = new FormData();
    fd.set("tenant_id", tenantId);
    fd.set("logo", listo);
    startTransition(() => dispatch(fd));
  };

  const quitar = () => {
    startQuitar(async () => {
      const r = await quitarLogo(tenantId);
      setConfirmarQuitar(false);
      if (r.ok) toast.success(r.mensaje ?? "Logo eliminado.");
      else toast.error(r.error ?? "No se pudo quitar el logo.");
    });
  };

  const ocupado = subiendo || quitando || preparando;

  // La marca del cliente ya se ve en la cabecera de su tarjeta: repetirla aquí
  // sería el mismo círculo dos veces. Este bloque es solo la acción.
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={elegir} loading={ocupado}>
            {logoUrl ? "Reemplazar logo" : "Subir logo"}
          </Button>
          {logoUrl && (
            <button
              type="button"
              onClick={() => setConfirmarQuitar(true)}
              disabled={ocupado}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-rojo transition duration-150 hover:bg-rojo/5 disabled:opacity-50"
            >
              Quitar
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          PNG, JPG, SVG o WebP · máx. 2 MB. Los rasterizados se reducen a{" "}
          {LOGO_MAX_ANCHO} px de ancho al subirlos.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPT}
        onChange={onArchivo}
        className="hidden"
        aria-label={`Logo de ${limpiarNombreTenant(nombre)}`}
      />

      <ConfirmDialog
        open={confirmarQuitar}
        tono="danger"
        titulo="¿Quitar el logo?"
        descripcion={`${limpiarNombreTenant(
          nombre
        )} volverá a mostrarse con sus iniciales en el portal y en el panel. Puedes subir otro cuando quieras.`}
        confirmar="Sí, quitar"
        cancelar="Cancelar"
        cargando={quitando}
        onConfirm={quitar}
        onCancel={() => setConfirmarQuitar(false)}
      />
    </div>
  );
}
