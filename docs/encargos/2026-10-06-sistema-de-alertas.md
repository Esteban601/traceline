# Encargo: Sistema de alertas por correo

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/alertas` desde `dev/ajustes-sep26`; PR a `dev`, luego a `main` y despliegue según `CLAUDE.md` v1.8.
**Fecha de inicio:** 6 de octubre de 2026 · **Aprobado por:** Manuel.
**Referencia:** inventario de notificaciones del 6 de octubre (especificación §10); plantillas y envío de correo existentes (invitación, envío de solicitud, observación, recordatorio programado, digest).

## 1. Objetivo

Que ningún evento que requiere la atención de una persona se quede sin aviso, y que ningún aviso se convierta en ruido. Dos canales: **inmediato** para lo conversacional (alguien escribió o espera respuesta) y **digest diario** para los cambios de estado. Un interruptor por usuario para los correos diarios.

## 2. Alcance

Eventos nuevos y su canal:

| Evento | Canal | Destinatarios |
|---|---|---|
| Comentario del auditor | inmediato | administrador del cliente y staff asignado a la emisora |
| Respuesta a un comentario del auditor | inmediato | el auditor que lo escribió |
| Documento del suplemento aprobado | inmediato | administrador del cliente |
| Solicitudes validadas ayer | digest diario | responsable y jefe del área |
| Visto bueno pendiente (evidencias recibidas sin VB) | digest diario | jefe de área |
| Evidencias nuevas pendientes de validar | digest diario | validador (staff o administrador del cliente) |
| Sugerencias de captura pendientes de decidir | digest diario | quien puede decidir en esa área |

Lo que ya existe se conserva sin cambios: invitación, envío de solicitud, observación, recordatorio programado ("faltan N días"), digest de pendientes y recuperación de contraseña.

Incluye:
- El digest actual pasa a tener secciones (pendientes de entrega, observaciones, validadas ayer, VB pendiente, evidencias por validar, sugerencias por decidir); una sección vacía no se muestra; un digest sin secciones no se manda. Mantiene el máximo de uno cada 5 días por persona **solo** para la sección de pendientes de entrega; las secciones nuevas salen cuando hay novedad del día anterior.
- Interruptor por usuario "Recibir resumen diario" (encendido por defecto), en su perfil; los inmediatos no se apagan.
- Direcciones `.example` y usuarios inactivos: nunca se envía; se registra como omitido, con el mismo criterio en todos los eventos (hoy el programado lo registra como fallo y el digest como omitido; se unifica a omitido).
- Bitácora: una acción por tipo de correo, con destinatario (id, no dirección), evento origen y modo (enviado / omitido / fallido).
- Plantillas con el mismo diseño que las actuales; asunto que diga la emisora y el evento; enlace directo al objeto (solicitud, comentario, documento).
- Tope de seguridad: máximo 20 correos inmediatos por emisora y hora; al superarlo, se agrupan en uno y se registra.
- Pruebas en local con correo a consola; en `traceline-dev` con Resend apuntando a un dominio de pruebas o a consola; nunca contra staging.

No incluye:
- Notificaciones dentro de la plataforma (campana), SMS ni WhatsApp.
- Cambiar la hora del digest (13:00 UTC) ni la lógica de recordatorios programados.
- Preferencias por tipo de evento (solo el interruptor global del digest).

## 3. Definición de terminado

- e2e por evento: ocurre el evento → correo correcto a los destinatarios correctos, ninguno a `.example` ni a inactivos, fila de bitácora con modo. El auditor recibe solo las respuestas a sus comentarios; nunca el digest.
- Digest: prueba con un día con novedades en las seis secciones y otro sin ninguna (no se manda).
- Interruptor por usuario probado: apagado → sin digest, sigue recibiendo inmediatos.
- Tope de 20 por hora probado.
- `tsc`, `eslint`, `verify:export`, build de producción.
- Especificación: sección "Notificaciones" con la tabla completa de eventos y canales, sustituyendo el inventario.
- Despliegue según guion (código solo, salvo que la bitácora requiera una migración aditiva), registro en §10.

## 4. Pasos y paradas

0. Resumen de una página: cómo funcionan hoy el envío de correo, las plantillas, el digest y la bitácora de correo; dónde se engancha cada evento nuevo; si hace falta tabla o columna nueva. Parada.
1. Inmediatos (los tres) con plantillas y bitácora. Parada: captura de cada correo renderizado.
2. Digest con secciones e interruptor por usuario. Parada: captura del digest completo y del vacío.
3. Tope, omitidos unificados, e2e completos, especificación. PR a `dev`. Parada.
4. PR a `main` y despliegue.

## 5. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-10-06 | Inventario de notificaciones; Manuel aprueba el encargo | Dos canales (inmediato / digest), interruptor global del digest por usuario |
| 2026-10-06 | **Paso 0** (resumen en el chat). Hoy: transporte Resend/consola que omite dominios reservados solo con Resend activo; cinco plantillas con un `layout` común y enlaces solo al portal; digest por responsable, uno cada 5 días leído de la bitácora y **sin filtrar inactivos**; programado a los usuarios activos del área, idempotente; `fn_log_correo` con acción de texto libre (los tipos nuevos no necesitan migración) y `detalle` con la dirección del destinatario; el programado registra lo omitido como fallo y sin fila por destinatario. No existe la asignación de staff a una emisora ni una página de cuenta del usuario, y `perfiles_usuario` no admite que un usuario se edite a sí mismo | **Decisiones de Esteban:** (1) el comentario del auditor va a **todo el staff activo**; `tenant_staff` queda como **deuda**, para cuando haya más de una emisora real con auditor. (2) Tabla `correos_retenidos` (aditiva, solo staff, con barrera) que el job de 10 minutos vacía en un correo agrupado. (3) Los digests del staff excluyen los tenants `es_demo`. (4) Sugerencias: los usuarios del área y el jefe reciben los ítems; el admin del cliente, una línea con el conteo por área. (5) Digest del staff: un correo combinado con secciones por emisora, asunto «TRACELINE · Resumen diario · N emisoras». (6) Id en lugar de dirección en la bitácora, **también en los cuatro correos existentes**: es una corrección de privacidad, la excepción a «lo existente no cambia». (7) Transporte de prueba `EMAIL_TRANSPORTE=archivo`, bloqueado con `NODE_ENV=production` y con el archivo ignorado por git. Interruptor: `perfiles_usuario.recibe_resumen_diario` + `fn_set_resumen_diario(bool)` SECURITY DEFINER (solo la fila propia, rechaza al auditor) y una página «Mi cuenta» mínima en el portal y en el panel. Inmediatos con `after()`. El programado registra los omitidos con `modo = omitido` y una fila por destinatario; el bloqueo de 5 días pasa a una condición explícita sobre `modo = enviado` |
