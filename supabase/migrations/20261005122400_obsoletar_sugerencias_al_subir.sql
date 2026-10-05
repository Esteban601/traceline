-- =============================================================================
-- Una versión nueva de la evidencia deja obsoleta la sugerencia visible
-- (encargo 2026-10-04, captura sugerida — Paso 4).
--
-- Hasta ahora lo hacía la cola al tomar la lectura de la versión nueva. Eso
-- dependía de que la lectura corriera: con la bandera apagada, el tope del mes
-- alcanzado o la cola atrasada, la sugerencia sobre el archivo reemplazado
-- seguía en pantalla. Ahora lo hace la base en el mismo INSERT de la evidencia.
-- Las decisiones ya tomadas (confirmada / corregida / rechazada) no se tocan:
-- se conservan como historial.
--
-- Aditiva: función y trigger nuevos. Idempotente. No crea tabla; la barrera se
-- vuelve a aplicar igual.
-- =============================================================================

create or replace function public.fn_evidencia_obsoleta_sugerencias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sugerencias_captura
     set estado = 'obsoleta'
   where solicitud_id = new.solicitud_id
     and estado in ('sugerida', 'sin_hallazgo')
     and evidencia_version < new.version;
  return new;
end;
$$;

revoke all on function public.fn_evidencia_obsoleta_sugerencias() from public;

drop trigger if exists trg_evidencia_obsoleta_sugerencias on public.evidencias;
create trigger trg_evidencia_obsoleta_sugerencias
  after insert on public.evidencias
  for each row execute function public.fn_evidencia_obsoleta_sugerencias();

select public.fn_aplicar_barrera_auditor();
