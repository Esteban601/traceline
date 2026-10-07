-- =============================================================================
-- Historial de versiones por bloque y versiones aprobadas (encargo 2026-10-06,
-- suplemento-calidad — Paso 4; A6 completo, frentes (2) y (3)).
--
-- documentos_bloques guarda UN texto por bloque: una edición a mano pisaba lo
-- generado y una regeneración pisaba la edición, sin rastro (15 de septiembre
-- de 2026, bloque 4). Desde aquí cada texto que entra a un bloque deja una fila
-- en documentos_bloques_versiones: generación, edición manual, texto literal del
-- emisor y restauración, con texto, autor, fecha, fuentes y versión del prompt.
--
-- CÓMO ENTRA UNA VERSIÓN: por trigger, no por la aplicación. Cualquier camino
-- que escriba un texto en documentos_bloques —la ruta de bloque, la edición, la
-- restauración, un script— deja su versión, y nadie se la puede saltar. El
-- origen lo dice quien escribe en `documentos_bloques.origen_texto`; el autor es
-- `editado_por` en una edición y el usuario de la sesión en lo demás.
--
-- SOLO ALTAS. Sin grant ni política de escritura para usuarios, y un trigger
-- que rechaza UPDATE siempre y DELETE salvo el borrado en cascada del documento
-- (cuando el documento ya no existe).
--
-- QUIÉN LEE: igual que documentos_bloques —staff, y el administrador del
-- cliente de su emisora—. El auditor, no: el suplemento está fuera de su
-- alcance (encargo rol auditor; confirmado por Esteban el 6 de octubre de 2026).
--
-- VERSIONES APROBADAS: documentos_generados.versiones_aprobadas fija, al
-- aprobar, qué versión de cada bloque compone el documento:
-- {numero: {"id": uuid, "version": n}}. El Word aprobado se arma con esas y las
-- registra en sus propiedades.
--
-- Aditiva: tabla nueva, columnas nullable, triggers nuevos, relleno de la
-- versión 1 de los textos que ya existen. Termina con la barrera.
-- =============================================================================

alter table public.documentos_bloques
  add column if not exists origen_texto text
    check (origen_texto in ('generacion', 'edicion', 'literal', 'restauracion'));
alter table public.documentos_bloques
  add column if not exists restaurada_de uuid;

comment on column public.documentos_bloques.origen_texto is
  'De dónde salió el texto actual: generacion, edicion, literal (texto del emisor) o restauracion. Lo escribe quien guarda el texto; el trigger lo copia a la versión.';
comment on column public.documentos_bloques.restaurada_de is
  'Si el texto actual es una restauración, la versión restaurada (documentos_bloques_versiones.id).';

alter table public.documentos_generados
  add column if not exists versiones_aprobadas jsonb;

comment on column public.documentos_generados.versiones_aprobadas is
  'Al aprobar: la versión de cada bloque que compone el documento, {numero: {id, version}}. El Word aprobado se arma con ellas y las registra en sus propiedades.';

create table if not exists public.documentos_bloques_versiones (
  id               uuid primary key default gen_random_uuid(),
  documento_id     uuid not null references public.documentos_generados (id) on delete cascade,
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  numero           integer not null,
  version          integer not null,
  origen           text not null check (origen in ('generacion', 'edicion', 'literal', 'restauracion')),
  texto            text not null,
  fuentes          jsonb not null default '[]'::jsonb,
  pendientes       jsonb not null default '[]'::jsonb,
  prompt_version   text,
  modelo           text,
  texto_del_emisor boolean not null default false,
  costo_usd        numeric(10, 4) not null default 0,
  autor_id         uuid references public.perfiles_usuario (id) on delete set null,
  -- Si el texto lleva una edición humana: quién y cuándo (una restauración de
  -- una edición la conserva). Es lo que pide la confirmación antes de regenerar.
  editado_por      uuid references public.perfiles_usuario (id) on delete set null,
  editado_en       timestamptz,
  restaurada_de    uuid references public.documentos_bloques_versiones (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (documento_id, numero, version)
);

comment on table public.documentos_bloques_versiones is
  'Historial de textos de cada bloque del Suplemento: una fila por generación, edición manual, texto literal y restauración. Solo altas, por trigger desde documentos_bloques (encargo suplemento-calidad, Paso 4).';

create index if not exists documentos_bloques_versiones_bloque_idx
  on public.documentos_bloques_versiones (documento_id, numero, version desc);

alter table public.documentos_bloques_versiones enable row level security;

drop policy if exists bloques_versiones_staff_select on public.documentos_bloques_versiones;
create policy bloques_versiones_staff_select on public.documentos_bloques_versiones
  for select to authenticated
  using (public.fn_is_staff());

drop policy if exists bloques_versiones_admin_cliente_select on public.documentos_bloques_versiones;
create policy bloques_versiones_admin_cliente_select on public.documentos_bloques_versiones
  for select to authenticated
  using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

revoke insert, update, delete on public.documentos_bloques_versiones from authenticated, anon;
drop policy if exists bloques_versiones_no_insert on public.documentos_bloques_versiones;
create policy bloques_versiones_no_insert on public.documentos_bloques_versiones
  as restrictive for insert to authenticated with check (false);
drop policy if exists bloques_versiones_no_update on public.documentos_bloques_versiones;
create policy bloques_versiones_no_update on public.documentos_bloques_versiones
  as restrictive for update to authenticated using (false);
drop policy if exists bloques_versiones_no_delete on public.documentos_bloques_versiones;
create policy bloques_versiones_no_delete on public.documentos_bloques_versiones
  as restrictive for delete to authenticated using (false);

grant select on public.documentos_bloques_versiones to authenticated;
grant select on public.documentos_bloques_versiones to service_role;

-- -----------------------------------------------------------------------------
-- Solo altas: ni UPDATE ni DELETE, salvo la cascada del documento borrado.
-- -----------------------------------------------------------------------------
create or replace function public.fn_bloques_versiones_solo_altas()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.documentos_generados d where d.id = old.documento_id) then
    return old;
  end if;
  raise exception 'documentos_bloques_versiones es de solo altas: una versión no se cambia ni se borra';
end;
$$;

drop trigger if exists trg_bloques_versiones_solo_altas on public.documentos_bloques_versiones;
create trigger trg_bloques_versiones_solo_altas
  before update or delete on public.documentos_bloques_versiones
  for each row execute function public.fn_bloques_versiones_solo_altas();

-- -----------------------------------------------------------------------------
-- Alta de versión: cada texto nuevo de un bloque.
--
-- Cuenta como versión nueva un INSERT con texto, o un UPDATE que cambia el
-- texto o que vuelve a generar (generado_en distinto con origen generacion o
-- literal: «una fila por generación», aunque salga el mismo texto). Un texto
-- NULL —encolar, no aplica, error— no es versión.
-- -----------------------------------------------------------------------------
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
     texto_del_emisor, costo_usd, autor_id, editado_por, editado_en, restaurada_de)
  values
    (new.documento_id, v_tenant, new.numero, v_version, v_origen, new.texto,
     coalesce(new.fuentes, '[]'::jsonb), coalesce(new.pendientes, '[]'::jsonb), new.prompt_version, new.modelo,
     coalesce(new.texto_del_emisor, false), coalesce(new.costo_usd, 0),
     case when v_origen = 'edicion' then coalesce(new.editado_por, auth.uid()) else auth.uid() end,
     new.editado_por, new.editado_en, new.restaurada_de);
  return new;
end;
$$;

revoke all on function public.fn_bloque_registrar_version() from public;

drop trigger if exists trg_bloque_registrar_version on public.documentos_bloques;
create trigger trg_bloque_registrar_version
  after insert or update on public.documentos_bloques
  for each row execute function public.fn_bloque_registrar_version();

-- -----------------------------------------------------------------------------
-- Relleno: la versión 1 de cada texto que ya existe.
-- -----------------------------------------------------------------------------
insert into public.documentos_bloques_versiones
  (documento_id, tenant_id, numero, version, origen, texto, fuentes, pendientes, prompt_version, modelo,
   texto_del_emisor, costo_usd, autor_id, editado_por, editado_en, created_at)
select b.documento_id, d.tenant_id, b.numero, 1,
       case when b.editado_en is not null then 'edicion' when b.texto_del_emisor then 'literal' else 'generacion' end,
       b.texto, coalesce(b.fuentes, '[]'::jsonb), coalesce(b.pendientes, '[]'::jsonb), b.prompt_version, b.modelo,
       b.texto_del_emisor, coalesce(b.costo_usd, 0),
       coalesce(b.editado_por, d.generado_por), b.editado_por, b.editado_en,
       coalesce(b.editado_en, b.generado_en, b.updated_at, now())
  from public.documentos_bloques b
  join public.documentos_generados d on d.id = b.documento_id
 where b.texto is not null
   and not exists (select 1 from public.documentos_bloques_versiones v where v.documento_id = b.documento_id and v.numero = b.numero);

update public.documentos_bloques
   set origen_texto = case when editado_en is not null then 'edicion' when texto_del_emisor then 'literal' else 'generacion' end
 where texto is not null and origen_texto is null;

select public.fn_aplicar_barrera_auditor();
