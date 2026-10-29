-- =============================================================================
-- Sección «Efectos financieros» del Perfil del emisor (encargo
-- 2026-10-29-perfil-declaraciones-alta, Fase 1; decisiones 2, 3 y 5 de Esteban
-- del Paso 0).
--
--   · perfil_emisor.criterio_cuantificacion — si la emisora da información
--     cuantitativa sobre los efectos financieros actuales y previstos y, si no,
--     por qué (NIIF S2 19–21). Responde NIIF S2 21(a) (bloque 10).
--   · perfil_emisor.congruencia_estados_financieros — si los datos y supuestos
--     de la información relacionada con el clima son congruentes con los de los
--     estados financieros (NIIF S2 B65(e)). Responde B65(e) (bloque 10).
--
-- Hoy ninguna sección del Perfil las pide: en el demo salen de dos solicitudes
-- que crea scripts/poblar-demo.mjs, y una emisora real deja el bloque 10 con
-- esos dos requisitos pendientes.
--
-- Los adjuntos de la sección nueva van en perfil_emisor_adjuntos con
-- seccion = 'efectos': el CHECK de las nueve secciones se sustituye por uno más
-- amplio con la décima (CLAUDE.md §3). Las filas existentes cumplen los dos. El
-- storage no cambia: sus políticas acotan por la carpeta del tenant, no por la
-- sección, así que no es más permisivo que la tabla.
--
-- ADITIVA: dos columnas nullable en una tabla con RLS existente y un CHECK más
-- amplio. La llamada a la barrera es idempotente y va aunque no se cree tabla.
-- =============================================================================

alter table public.perfil_emisor add column if not exists criterio_cuantificacion text;
alter table public.perfil_emisor add column if not exists congruencia_estados_financieros text;

comment on column public.perfil_emisor.criterio_cuantificacion is 'Criterio de cuantificación de los efectos financieros (NIIF S2 19–21): si la emisora da información cuantitativa y, si no, por qué. Hecho del bloque 10 con clave fija emisora.criterio_cuantificacion; responde NIIF S2 21(a).';
comment on column public.perfil_emisor.congruencia_estados_financieros is 'Congruencia de los datos y supuestos de la información relacionada con el clima con los de los estados financieros (NIIF S2 B65(e)). Hecho del bloque 10 con clave fija emisora.congruencia_estados_financieros.';

alter table public.perfil_emisor_adjuntos drop constraint if exists perfil_emisor_adjuntos_seccion_chk;
alter table public.perfil_emisor_adjuntos add constraint perfil_emisor_adjuntos_seccion_chk check (
  seccion in (
    'identidad',
    'matriz',
    'horizontes',
    'carta',
    'historia',
    'trayectoria',
    'modelo',
    'gobierno',
    'materialidad',
    'efectos'
  )
);

select public.fn_aplicar_barrera_auditor();
