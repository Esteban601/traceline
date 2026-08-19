-- =============================================================================
-- Convergencia de `perfiles_staff_visible_al_cliente`
--
-- POR QUÉ EXISTE ESTA MIGRACIÓN. La rama de BITÁCORA de esa política se añadió a
-- `20260820130000_admin_cliente.sql` DESPUÉS de que ese archivo ya se hubiera
-- aplicado a staging (salió de un code-review). Editar un archivo ya aplicado deja
-- ambientes divergentes sin que nadie lo note: local tendría cuatro ramas y
-- staging tres, y la diferencia se nota solo cuando un cliente ve «Sistema» donde
-- debería ir un nombre.
--
-- Así que en vez de confiar en qué versión quedó en cada ambiente, esta migración
-- vuelve a declarar la política completa. Es idempotente y converge los dos casos
-- al mismo estado: en una base nueva reemplaza una política idéntica (no-op
-- efectivo) y en staging le agrega la rama que le falta.
--
-- Regla que queda para adelante: una migración aplicada no se edita; se corrige
-- con otra.
-- =============================================================================

create index if not exists bitacora_usuario_idx on public.bitacora (usuario_id);

drop policy if exists perfiles_staff_visible_al_cliente on public.perfiles_usuario;

-- Los perfiles de IRStrat que este usuario puede ver son los que APARECEN en lo
-- que ya puede ver: quien subió su evidencia, capturó su valor, comentó en su
-- solicitud o dejó un acto en la bitácora de su tenant. No «el staff»: RLS es a
-- nivel de fila, y abrir la tabla dejaría enumerar el equipo completo de la firma
-- con sus correos y sus roles.
create policy perfiles_staff_visible_al_cliente on public.perfiles_usuario
  for select to authenticated
  using (
    tenant_id is null
    and activo
    and public.fn_current_tenant() is not null
    and (
      exists (
        select 1 from public.evidencias e
        where e.subido_por = perfiles_usuario.id
          and public.fn_puede_ver_solicitud(e.solicitud_id)
      )
      or exists (
        select 1 from public.capturas_valor v
        where v.capturado_por = perfiles_usuario.id
          and public.fn_puede_ver_solicitud(v.solicitud_id)
      )
      or exists (
        select 1 from public.comentarios c
        where c.autor_id = perfiles_usuario.id
          and public.fn_puede_ver_solicitud(c.solicitud_id)
      )
      -- Buena parte de los actos de IRStrat SOLO dejan rastro en la bitácora
      -- (crear una solicitud, cambiar su estado, congelar un reporte, mover el
      -- toggle de carga). Sin esta rama, el cliente veía esas entradas como
      -- «Sistema»: no un dato que falta, una atribución falsa.
      or exists (
        select 1 from public.bitacora b
        where b.usuario_id = perfiles_usuario.id
          and b.tenant_id = public.fn_current_tenant()
      )
    )
  );
