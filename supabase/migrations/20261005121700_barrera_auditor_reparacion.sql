-- =============================================================================
-- Reparación idempotente de la barrera del auditor (01/10/2026).
--
-- Por qué: el proyecto dev de Esteban tenía 20260929130000_rol_auditor como
-- aplicada, pero sin public.fn_aplicar_barrera_auditor(). Lo más probable es que
-- recibiera un borrador de esa migración de antes de que la barrera pasara a una
-- función. Sin la función, cualquier migración futura que la llame (CLAUDE.md §3
-- lo exige para toda tabla y todo bucket nuevos) falla en ese proyecto.
--
-- Qué hace: vuelve a crear la función EXACTAMENTE como en 20260929130000, con
-- su comentario y su revoke, comprueba que existe una sola y la llama. Donde ya
-- estaba (staging, local, ensayo) no cambia nada: la función queda idéntica y la
-- barrera converge a las mismas políticas (69 en staging). El número depende de
-- cuántas tablas de public tienen RLS: en dev, con las tablas del generador, es
-- mayor. Se imprime como NOTICE para que quede en la salida de db push.
-- =============================================================================

create or replace function public.fn_aplicar_barrera_auditor()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  n integer := 0;
begin
  for t in
    select c.relname as tabla
    from pg_class c
    join pg_namespace n2 on n2.oid = c.relnamespace
    where n2.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      -- Las dos tablas del propio rol se excluyen: comentarios_auditor porque
      -- es donde el auditor SÍ escribe, y auditor_actividad porque ya trae sus
      -- propias restrictivas con `false`, que son más estrictas que esta.
      and c.relname not in ('comentarios_auditor', 'auditor_actividad')
    order by c.relname
  loop
    execute format('drop policy if exists %I on public.%I', 'auditor_sin_insert_' || t.tabla, t.tabla);
    execute format('drop policy if exists %I on public.%I', 'auditor_sin_update_' || t.tabla, t.tabla);
    execute format('drop policy if exists %I on public.%I', 'auditor_sin_delete_' || t.tabla, t.tabla);

    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated
         with check (not public.fn_is_auditor())',
      'auditor_sin_insert_' || t.tabla, t.tabla);

    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated
         using (not public.fn_is_auditor()) with check (not public.fn_is_auditor())',
      'auditor_sin_update_' || t.tabla, t.tabla);

    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated
         using (not public.fn_is_auditor())',
      'auditor_sin_delete_' || t.tabla, t.tabla);

    n := n + 3;
  end loop;

  -- Storage. La barrera NO se acota a un bucket: el auditor no escribe en
  -- ninguno (ni evidencias, ni logos, ni vitrina, ni los que vengan). Su lectura
  -- de archivos sigue por evidencias_tenant_select, que solo mira la carpeta del
  -- tenant y no toca estas políticas. Por eso un bucket nuevo tampoco necesita
  -- nada propio: ya nace cubierto.
  drop policy if exists auditor_sin_insert_storage on storage.objects;
  drop policy if exists auditor_sin_update_storage on storage.objects;
  drop policy if exists auditor_sin_delete_storage on storage.objects;

  create policy auditor_sin_insert_storage on storage.objects
    as restrictive for insert to authenticated
    with check (not public.fn_is_auditor());

  create policy auditor_sin_update_storage on storage.objects
    as restrictive for update to authenticated
    using (not public.fn_is_auditor()) with check (not public.fn_is_auditor());

  create policy auditor_sin_delete_storage on storage.objects
    as restrictive for delete to authenticated
    using (not public.fn_is_auditor());

  return n + 3;
end;
$$;

comment on function public.fn_aplicar_barrera_auditor is
  'Pone (o repone) la barrera restrictiva que impide al rol auditor INSERT/UPDATE/DELETE en toda tabla de public con RLS y en storage.objects. Idempotente y convergente. LLÁMALA AL FINAL DE TODA MIGRACIÓN QUE CREE UNA TABLA O UN BUCKET — ver CLAUDE.md §3.';

-- No se otorga a `authenticated`: crear políticas no es una operación de
-- aplicación. La ejecutan las migraciones, que corren como el dueño del esquema.
revoke all on function public.fn_aplicar_barrera_auditor() from public;

do $$
declare
  n_funciones integer;
  n_politicas integer;
begin
  select count(*) into n_funciones from pg_proc where proname = 'fn_aplicar_barrera_auditor';
  if n_funciones <> 1 then
    raise exception 'se esperaba 1 función fn_aplicar_barrera_auditor y hay %', n_funciones;
  end if;
  n_politicas := public.fn_aplicar_barrera_auditor();
  raise notice 'barrera del auditor: % función, % políticas', n_funciones, n_politicas;
end $$;
