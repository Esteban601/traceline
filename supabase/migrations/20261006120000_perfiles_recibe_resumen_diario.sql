-- =============================================================================
-- Interruptor «Recibir resumen diario», por usuario (encargo
-- 2026-10-06-sistema-de-alertas, Paso 2).
--
-- La columna nace ENCENDIDA para todos: el resumen diario es el canal por el que
-- llegan los cambios de estado, y apagarlo es una decisión de cada persona. Los
-- avisos inmediatos (lo conversacional) no dependen de ella y no se apagan.
--
-- POR QUÉ UNA FUNCIÓN Y NO UNA POLÍTICA. `perfiles_usuario` no tiene política de
-- edición propia: la editan el staff y el administrador del cliente. Abrir un
-- UPDATE sobre la fila propia dejaría a cada usuario cambiarse el rol, el área o
-- el tenant. `fn_set_resumen_diario` es SECURITY DEFINER y toca UNA columna de
-- UNA fila: la de auth.uid(). El auditor externo la recibe rechazada: no recibe
-- resumen diario, y la barrera del auditor (no escribe en ninguna tabla) se
-- sostiene también por esta puerta.
--
-- Aditiva: una columna con default y una función. Idempotente.
-- =============================================================================

alter table public.perfiles_usuario
  add column if not exists recibe_resumen_diario boolean not null default true;

comment on column public.perfiles_usuario.recibe_resumen_diario is
  'Interruptor del resumen diario por correo (encendido por defecto). Lo cambia cada usuario con fn_set_resumen_diario; los avisos inmediatos no dependen de él.';

create or replace function public.fn_set_resumen_diario(p_recibir boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
begin
  if v_uid is null then
    raise exception 'Sesión no válida.' using errcode = '42501';
  end if;
  if public.fn_is_auditor() then
    raise exception 'El auditor externo no recibe resumen diario.' using errcode = '42501';
  end if;
  if p_recibir is null then
    raise exception 'Indica si quieres recibir el resumen diario.' using errcode = 'PT400';
  end if;

  update public.perfiles_usuario
     set recibe_resumen_diario = p_recibir
   where id = v_uid
  returning tenant_id into v_tenant;

  if not found then
    raise exception 'No se encontró tu perfil.' using errcode = 'PT404';
  end if;

  insert into public.bitacora (tenant_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (v_tenant, v_uid, 'preferencia_resumen_diario', 'perfiles_usuario', v_uid,
          jsonb_build_object('recibir', p_recibir));

  return p_recibir;
end;
$$;

revoke all on function public.fn_set_resumen_diario(boolean) from public, anon;
grant execute on function public.fn_set_resumen_diario(boolean) to authenticated;

comment on function public.fn_set_resumen_diario(boolean) is
  'El usuario enciende o apaga SU resumen diario. Solo la fila de auth.uid(); rechaza al auditor externo. Deja la preferencia en bitácora.';

-- No crea tablas ni buckets; la llamada va igual (CLAUDE.md §3) y devuelve las
-- políticas de la barrera, que no cambian.
select public.fn_aplicar_barrera_auditor();
