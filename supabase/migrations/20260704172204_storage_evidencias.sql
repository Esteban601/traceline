-- =============================================================================
-- Storage — bucket privado 'evidencias' y políticas de acceso
--
-- Convención de ruta:  {tenant_id}/{solicitud_id}/<archivo>
--   folder[1] = tenant_id  ·  folder[2] = solicitud_id
--
-- Reglas:
--   * staff IRStrat: acceso total (lectura/escritura/gestión).
--   * usuario de tenant: sube y lee solo bajo la ruta de su tenant, y solo a
--     solicitudes que tiene permitido ver (fn_puede_ver_solicitud).
--   * bucket privado: nada es público; el acceso siempre pasa por estas políticas.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

-- storage.objects ya tiene RLS habilitado por Supabase; solo agregamos políticas.

-- Staff: acceso total dentro del bucket.
create policy evidencias_staff_all on storage.objects
  for all to authenticated
  using (bucket_id = 'evidencias' and public.fn_is_staff())
  with check (bucket_id = 'evidencias' and public.fn_is_staff());

-- Usuario de tenant: lectura de objetos bajo la ruta de su tenant.
create policy evidencias_tenant_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidencias'
    and (storage.foldername(name))[1] = public.fn_current_tenant()::text
  );

-- Usuario de tenant: subida solo bajo {su_tenant}/{solicitud_visible}/...
create policy evidencias_tenant_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and public.fn_current_tenant() is not null
    and (storage.foldername(name))[1] = public.fn_current_tenant()::text
    and public.fn_puede_ver_solicitud(((storage.foldername(name))[2])::uuid)
  );

-- Nota: no se otorgan UPDATE/DELETE a usuarios de tenant sobre storage.objects,
-- en línea con la inmutabilidad de la evidencia (solo staff puede gestionar).
