-- =============================================================================
-- Texto del emisor sin reescribir (encargo 2026-10-06, suplemento-calidad —
-- Paso 3 (c)).
--
-- En un bloque EDITORIAL se puede elegir «usar el texto de este archivo sin
-- reescribir»: el bloque lleva el contenido literal de un adjunto del Perfil,
-- con su cita, sin pasar por el modelo.
--
--   · documentos_generados.textos_literales: qué adjunto usa cada bloque
--     editorial del documento, {clave_del_bloque: adjunto_id}. NULL = ninguno.
--   · documentos_bloques.texto_del_emisor: el texto guardado es el del emisor,
--     copiado del archivo. La revisión lo marca, la pasada de coherencia no
--     propone cambiarlo (solo avisa de incoherencias con el resto) y una
--     regeneración lo vuelve a copiar en vez de reescribirlo.
--
-- Aditiva: dos columnas, una nullable y otra con default. Sin tabla nueva; la
-- barrera se llama igual, por regla de la casa (es idempotente).
-- =============================================================================

alter table public.documentos_generados
  add column if not exists textos_literales jsonb;

comment on column public.documentos_generados.textos_literales is
  'Bloques editoriales que llevan el texto literal de un adjunto del Perfil: {clave_del_bloque: adjunto_id}. NULL = ninguno (encargo suplemento-calidad, Paso 3).';

alter table public.documentos_bloques
  add column if not exists texto_del_emisor boolean not null default false;

comment on column public.documentos_bloques.texto_del_emisor is
  'El texto es el del emisor, copiado literal de un adjunto del Perfil, sin pasar por el modelo. Se marca en la revisión y la pasada de coherencia no propone reescribirlo.';

select public.fn_aplicar_barrera_auditor();
