-- =============================================================================
-- Declaración de cumplimiento del reporte (encargo s1-72-reserva-y-emisora,
-- decisiones 2 y 5 de Esteban).
--
--   · reportes.declaracion_cumplimiento — «sin_reserva» o «con_reserva»: si la
--     emisora declara que cumple con todos los requerimientos de NIIF S1 y S2,
--     explícitamente y sin reservas (NIIF S1 72). Decide la fila 286 del
--     Formato electrónico.
--   · reportes.declaracion_cumplimiento_texto — la declaración, en palabras de
--     la emisora. El generador nunca la redacta: va tal cual en el bloque 2, en
--     NIIF S1 72 y en la fila 285. Sin texto, el bloque 2 lleva el marcador de
--     pendiente y el documento no se aprueba (CLAUDE.md §5).
--
-- Viven en el reporte y no en el Perfil: la declaración es de un ejercicio.
--
-- RELLENO (decisión 2): en los reportes de tenants de demostración (es_demo) se
-- prellena «sin_reserva» con la oración que hoy escribe la plantilla del bloque
-- 2, para que el demo y los mockups no cambien de texto. Solo si el Perfil tiene
-- denominación formal (sin ella la oración llevaría un marcador, que no es
-- texto de la emisora): esos reportes quedan «sin_reserva» y sin texto. Los
-- tenants reales no se tocan: llevarán el marcador hasta que se capture.
--
-- ADITIVA: dos columnas nullable con CHECK en una tabla con RLS existente; la
-- llamada a la barrera es idempotente y va aunque no se cree tabla (CLAUDE.md §3).
-- =============================================================================

alter table public.reportes add column if not exists declaracion_cumplimiento text
  constraint reportes_declaracion_cumplimiento_chk
  check (declaracion_cumplimiento is null or declaracion_cumplimiento in ('sin_reserva', 'con_reserva'));
alter table public.reportes add column if not exists declaracion_cumplimiento_texto text;

comment on column public.reportes.declaracion_cumplimiento is 'Declaración de cumplimiento de NIIF S1 72: sin_reserva (cumple con todos los requerimientos, explícitamente y sin reservas) o con_reserva. Null = sin capturar. Decide la fila 286 del Formato electrónico: con_reserva → «No» siempre.';
comment on column public.reportes.declaracion_cumplimiento_texto is 'La declaración de cumplimiento en palabras de la emisora, tal cual. Va en el bloque 2, en NIIF S1 72 y en la fila 285 del Formato electrónico. El generador nunca la redacta; sin texto, el bloque 2 lleva [Pendiente: declaración de cumplimiento de la emisora — Reportes, régimen del ejercicio].';

-- Relleno de los tenants de demostración: solo los reportes sin declaración (idempotente).
update public.reportes r
set declaracion_cumplimiento = 'sin_reserva',
    declaracion_cumplimiento_texto = case
      when nullif(btrim(p.denominacion_formal), '') is null then null
      else btrim(p.denominacion_formal)
        || ' (en adelante, ' || coalesce(nullif(btrim(p.forma_de_referencia), ''), 'la Compañía') || ')'
        || ' presenta la información a revelar relacionada con la sostenibilidad y con el clima correspondiente al ejercicio '
        || r.ejercicio::text
        || ', preparada de conformidad con las Normas NIIF S1 y NIIF S2 emitidas por el Consejo de Normas Internacionales de Sostenibilidad.'
    end
from public.tenants t
left join public.perfil_emisor p on p.tenant_id = t.id
where t.id = r.tenant_id
  and t.es_demo
  and r.declaracion_cumplimiento is null
  and r.declaracion_cumplimiento_texto is null;

select public.fn_aplicar_barrera_auditor();
