-- =============================================================================
-- Valor 'jefe_area' en el enum rol_usuario.
--
-- VA SOLO, como el de 'admin_cliente': Postgres prohíbe usar un valor de enum
-- nuevo en la misma transacción que lo crea, y la migración siguiente lo usa en
-- políticas y funciones.
--
-- Qué es: el JEFE de un área del cliente. Tiene los permisos del responsable de
-- área (ve y carga lo de SU área) más uno propio: dar y retirar el VISTO BUENO
-- DEL ÁREA sobre las solicitudes de su área. No valida —la validación final
-- sigue la regla de origen— y no administra usuarios.
-- =============================================================================

alter type public.rol_usuario add value if not exists 'jefe_area';
