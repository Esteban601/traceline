-- =============================================================================
-- Campos del Perfil del emisor para la sección [100000] del Formato electrónico
-- NIIF S1/S2 (encargo 2026-10-13-excel-respuestas-narrativas, Paso 4; Paso 0
-- aprobado por Esteban: «[100000] desde el Perfil con clave de cotización, tipo
-- de instrumento y fiduciario»; mapeo revisado: número de fideicomiso y hechos
-- posteriores).
--
--   · clave_cotizacion   — clave de pizarra en la BMV;
--   · tipo_instrumento   — acciones, deuda, fideicomiso (CKD, CERPI, FIBRA…);
--   · fiduciario         — institución fiduciaria, solo si es fideicomiso;
--   · numero_fideicomiso — número del fideicomiso emisor, solo si es fideicomiso;
--   · hechos_posteriores — hechos posteriores al cierre del ejercicio que afectan
--                          la información de sostenibilidad (NIIF S1 68).
--
-- ADITIVA: cinco columnas nullable en una tabla con RLS existente; la llamada a
-- la barrera es idempotente y va aunque no se cree tabla.
-- =============================================================================

alter table public.perfil_emisor add column if not exists clave_cotizacion text;
alter table public.perfil_emisor add column if not exists tipo_instrumento text;
alter table public.perfil_emisor add column if not exists fiduciario text;
alter table public.perfil_emisor add column if not exists numero_fideicomiso text;
alter table public.perfil_emisor add column if not exists hechos_posteriores text;

comment on column public.perfil_emisor.clave_cotizacion is 'Clave de cotización (pizarra) en la BMV; Formato electrónico [100000].';
comment on column public.perfil_emisor.tipo_instrumento is 'Tipo de instrumento que cotiza la emisora (acciones, deuda, fideicomiso); Formato electrónico [100000].';
comment on column public.perfil_emisor.fiduciario is 'Institución fiduciaria, solo si la emisora es un fideicomiso; Formato electrónico [100000].';
comment on column public.perfil_emisor.numero_fideicomiso is 'Número del fideicomiso emisor, solo si es fideicomiso; Formato electrónico [100000].';
comment on column public.perfil_emisor.hechos_posteriores is 'Hechos posteriores al cierre del ejercicio que afectan la información de sostenibilidad (NIIF S1 68); Formato electrónico [200000].';

select public.fn_aplicar_barrera_auditor();
