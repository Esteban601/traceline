-- =============================================================================
-- Storage — bucket privado 'documentos' y políticas de acceso.
--
-- Convención de ruta:  {tenant_id}/...
--   folder[1] = tenant_id
--
-- Guarda dos cosas que hoy no tienen dónde vivir:
--   * el .docx del suplemento, por documento y versión;
--   * el organigrama del perfil del emisor ({tenant_id}/perfil/<archivo>).
--
-- POR QUÉ UN BUCKET NUEVO Y NO 'evidencias'. La ruta de evidencias es
-- {tenant_id}/{solicitud_id}/… y sus políticas de escritura cuelgan de
-- `fn_puede_ver_solicitud`: un entregable no pertenece a ninguna solicitud, así
-- que no habría un folder[2] válido que comprobar. Forzarlo obligaría a inventar
-- una solicitud falsa o a relajar la política de evidencias, y esa política es la
-- que sostiene la inmutabilidad de la evidencia.
--
-- Privado, como evidencias: aquí vive el borrador de un documento oficial antes
-- de que nadie lo revise.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- storage.objects ya tiene RLS habilitado por Supabase; solo agregamos políticas.

-- Staff: acceso total dentro del bucket.
create policy documentos_staff_all on storage.objects
  for all to authenticated
  using (bucket_id = 'documentos' and public.fn_is_staff())
  with check (bucket_id = 'documentos' and public.fn_is_staff());

-- Administrador del cliente: lectura de lo que está bajo la ruta de SU tenant.
--
-- REGLA DE LA CASA: el storage nunca es más permisivo que la tabla que lo
-- referencia. Aquí viven el .docx del suplemento y el organigrama del perfil, y
-- ni `documentos_generados` ni `perfil_emisor` se abren a los usuarios de área;
-- si este bucket sí lo hiciera, el mismo material saldría por la puerta de atrás
-- con solo conocer la ruta — y la ruta del organigrama está escrita en
-- `perfil_emisor.organigrama_path`, que cualquier pantalla futura podría filtrar.
create policy documentos_admin_cliente_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and public.fn_is_admin_cliente()
    and (storage.foldername(name))[1] = public.fn_current_tenant()::text
  );

-- Escritura: solo el administrador del cliente, y solo bajo su propia ruta.
-- A diferencia de evidencias —donde cualquier usuario de área sube su archivo—
-- aquí lo que se escribe es el entregable de la emisora entera.
create policy documentos_admin_cliente_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and public.fn_is_admin_cliente()
    and public.fn_current_tenant() is not null
    and (storage.foldername(name))[1] = public.fn_current_tenant()::text
  );

create policy documentos_admin_cliente_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documentos'
    and public.fn_is_admin_cliente()
    and (storage.foldername(name))[1] = public.fn_current_tenant()::text
  )
  with check (
    bucket_id = 'documentos'
    and public.fn_is_admin_cliente()
    and (storage.foldername(name))[1] = public.fn_current_tenant()::text
  );

-- Nota: no se otorga DELETE a usuarios de tenant, en línea con evidencias. Un
-- documento generado es rastro de lo que se entregó; retirarlo es acción de
-- staff.
