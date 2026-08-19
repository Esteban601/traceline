-- =============================================================================
-- perfiles_usuario.debe_cambiar_password — cambio forzado en el primer ingreso.
--
-- Una contraseña temporal que se entrega FUERA de la plataforma (impresa en un
-- manual, dictada por teléfono, pegada en un correo) es conocida por alguien más
-- que su dueño desde el minuto uno. El flag hace que esa contraseña sirva para
-- exactamente una cosa: entrar a cambiarla. Mientras esté encendido, el
-- middleware manda a /restablecer y ninguna otra vista se renderiza.
--
-- DEFAULT false: las cuentas que existen hoy ya establecieron su contraseña por
-- la liga de invitación, que nunca es conocida por un tercero. Encenderlo es una
-- decisión explícita de quien da el alta.
--
-- GRANTS. Encenderlo no necesita ninguno nuevo: el grant de la migración inicial
-- es a nivel TABLA para `authenticated` y cubre las columnas que se agreguen
-- después, y quién puede hacerlo lo deciden las políticas que ya existen sobre
-- `perfiles_usuario` (staff, y el administrador del cliente sobre los suyos).
--
-- APAGARLO sí lo necesita: nadie puede escribir su propio perfil por RLS, así que
-- lo hace el servidor con service_role — que en este proyecto NO tiene privilegios
-- de escritura por default (medido: sobre `perfiles_usuario` solo SELECT). Se le
-- concede a NIVEL DE COLUMNA, que es todo lo que el flujo necesita: puede apagar
-- el flag y nada más de esa tabla — ni rol, ni tenant, ni área.
--
-- Se decidió NO exponer una función `security definer` para apagarlo: sería una
-- llamada RPC que cualquier sesión podría hacer desde el navegador para saltarse
-- el cambio sin cambiar nada. El único camino queda dentro de la acción que ya
-- comprobó el cambio.
-- =============================================================================

alter table public.perfiles_usuario
  add column debe_cambiar_password boolean not null default false;

comment on column public.perfiles_usuario.debe_cambiar_password is
  'true = la contraseña vigente es TEMPORAL y se entregó por un canal externo: al iniciar sesión, el middleware fuerza /restablecer antes de cualquier otra vista. Se apaga solo cuando la persona establece la definitiva (server action con service_role, tras auth.updateUser) o al canjear una invitación.';

grant update (debe_cambiar_password) on public.perfiles_usuario to service_role;
