-- =============================================================================
-- Campos del Perfil para la sección «Para: Fideicomisos» del Formato electrónico
-- [100000] (encargo formato-afirmaciones-y-voz, Fase 5; revisión externa v5).
--
--   · fideicomitente           — denominación del fideicomitente (fila 17);
--   · administrador_patrimonio — denominación del administrador del patrimonio
--                                del fideicomiso (fila 19).
--
-- Antes las filas 17 y 19 tomaban la razón social de la emisora; en un
-- fideicomiso no son la emisora, y en una emisora que no lo es, la sección
-- entera dice «No aplica».
--
-- ADITIVA: dos columnas nullable en una tabla con RLS existente; la llamada a la
-- barrera es idempotente y va aunque no se cree tabla.
-- =============================================================================

alter table public.perfil_emisor add column if not exists fideicomitente text;
alter table public.perfil_emisor add column if not exists administrador_patrimonio text;

comment on column public.perfil_emisor.fideicomitente is 'Denominación del fideicomitente, solo si la emisora es un fideicomiso; Formato electrónico [100000], fila 17.';
comment on column public.perfil_emisor.administrador_patrimonio is 'Denominación del administrador del patrimonio del fideicomiso, solo si la emisora es un fideicomiso; Formato electrónico [100000], fila 19.';

select public.fn_aplicar_barrera_auditor();
