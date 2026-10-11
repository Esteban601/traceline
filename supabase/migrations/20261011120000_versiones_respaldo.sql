-- =============================================================================
-- Respaldo de cada versión de bloque (fix/pre-v40, observación P2 de Codex sobre
-- el PR #17, decisión de Esteban del 11 de octubre de 2026).
--
-- Restaurar una versión reponía texto, fuentes y pendientes, pero no la
-- cobertura ni las anclas, que no se versionaban: la revisión y el validador
-- cruzado mostraban el respaldo de la generación más nueva como si fuera el del
-- texto restaurado. Ahora cada versión guarda:
--   · `respaldo` (jsonb): {cobertura, anclas} del bloque en ese momento;
--   · `libro_id`: el libro de hechos del que salió. El libro no se versiona por
--     bloque; se referencia por id. Sin llave foránea a propósito: la tabla es de
--     solo altas (trg_bloques_versiones_solo_altas) y un ON DELETE SET NULL
--     sería un UPDATE que el trigger rechaza.
-- Las versiones anteriores a esta migración quedan con ambos en null: al
-- restaurarlas, la cobertura y las anclas del bloque se limpian en vez de
-- mostrar las de otra versión.
--
-- ADITIVA: dos columnas nullable y la función del trigger reemplazada con los
-- mismos argumentos.
-- =============================================================================

alter table public.documentos_bloques_versiones
  add column if not exists respaldo jsonb;
alter table public.documentos_bloques_versiones
  add column if not exists libro_id uuid;

comment on column public.documentos_bloques_versiones.respaldo is
  'Cobertura y anclas del bloque cuando se registró la versión ({cobertura, anclas}); null en versiones anteriores al 11/10/2026.';
comment on column public.documentos_bloques_versiones.libro_id is
  'Libro de hechos del que salió la versión (sin FK: la tabla es de solo altas).';

create or replace function public.fn_bloque_registrar_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origen text := coalesce(new.origen_texto, 'generacion');
  v_tenant uuid;
  v_version integer;
begin
  if new.texto is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.texto is not distinct from old.texto
     and not (new.generado_en is distinct from old.generado_en and v_origen in ('generacion', 'literal'))
     and new.restaurada_de is not distinct from old.restaurada_de then
    return new;
  end if;

  select tenant_id into v_tenant from public.documentos_generados where id = new.documento_id;
  select coalesce(max(version), 0) + 1 into v_version
    from public.documentos_bloques_versiones
   where documento_id = new.documento_id and numero = new.numero;

  insert into public.documentos_bloques_versiones
    (documento_id, tenant_id, numero, version, origen, texto, fuentes, pendientes, prompt_version, modelo,
     texto_del_emisor, costo_usd, autor_id, editado_por, editado_en, restaurada_de, respaldo, libro_id)
  values
    (new.documento_id, v_tenant, new.numero, v_version, v_origen, new.texto,
     coalesce(new.fuentes, '[]'::jsonb), coalesce(new.pendientes, '[]'::jsonb), new.prompt_version, new.modelo,
     coalesce(new.texto_del_emisor, false), coalesce(new.costo_usd, 0),
     case when v_origen = 'edicion' then coalesce(new.editado_por, auth.uid()) else auth.uid() end,
     new.editado_por, new.editado_en, new.restaurada_de,
     jsonb_build_object('cobertura', new.cobertura, 'anclas', new.anclas), new.libro_id);
  return new;
end;
$$;

revoke all on function public.fn_bloque_registrar_version() from public;

select public.fn_aplicar_barrera_auditor();
