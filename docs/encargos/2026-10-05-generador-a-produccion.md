# Encargo: Generador y captura sugerida a producción (merge de `dev/ajustes-sep26` a `main`)

**Responsable:** Esteban (con Claude Code)
**Ramas:** `dev/ajustes-sep26` → `main`, por PR revisado con el asesor. Trabajo previo en `dev/ajustes-sep26` (renumeración y verificaciones) y en un proyecto Supabase de ensayo.
**Fecha de inicio:** 5 de octubre de 2026 · **Aprobado por:** Manuel (orden de trabajo acordado el 4 de octubre; MFA a la cola).
**Referencia:** `CLAUDE.md` v1.7 (§1, §3, §9), especificación §10 (releases y "Antes del merge a producción"), encargo del rol auditor §5 (guion de ensayo y despliegue), encargo de captura sugerida §7.

## 1. Objetivo

Llevar a staging (producción de facto, con Grupo Carso y la cuenta de Deloitte sobre CLEPSA) todo lo construido en `dev/ajustes-sep26` desde septiembre: perfil del emisor, generador del suplemento NIIF S1/S2, catálogo corregido con sus renombres, columna dinámica del Excel, lectura de evidencias con captura sugerida, mockups de Rotoplas y AINDA y sus configuraciones, con las banderas por emisora apagadas para clientes reales hasta que su contrato lo permita. Es el despliegue más grande desde julio y se trata como tal: ensayo completo sobre copia de producción, línea base, verificación y plan de reversión escritos antes de tocar staging.

## 2. Alcance

Incluye:
- **Reconciliación de migraciones.** Las migraciones de `dev` fechadas en septiembre son anteriores a las ya aplicadas en staging (`20260929*`, `20261001*`, `20261004*`). Decisión: **renumerar** las migraciones de `dev` que no están en staging con fechas posteriores a la última de staging, conservando el orden relativo y el contenido; sin `--include-all`. Verificación de que `migration list` local == dev tras la renumeración y de que una aplicación limpia en local produce el mismo esquema (comparación de `pg_dump --schema-only` normalizado antes y después).
- **Verificaciones previas sobre staging (solo lectura):** ninguna evidencia supera 25 MB (`storage.objects`); conteo de tablas que la barrera del auditor cubrirá (de 69 a 81 políticas, como en dev); no hay datos en staging que violen CHECKs o NOT NULL que `dev` introduce; `generaciones_mes_max`, `lecturas_mes_max`, `lectura_evidencias_activa` y `vitrina_habilitada` con sus valores por tenant decididos (§3).
- **Permisos de `service_role`:** inventario de lo que `dev` y los scripts necesitan y lo que el proyecto alojado concede por defecto; si hay diferencia que afecte a la aplicación en Heroku, se declara en migración; si solo afecta a scripts locales, se anota como deuda.
- **A8 (pruebas en Heroku):** app de dev en Heroku (`traceline-dev`) con el código de `dev` contra el proyecto de ensayo; generación de un bloque y de un documento completo del demo desde Heroku (latencia por bloque, `maxDuration`, `after()` bajo dyno real); prueba de aislamiento multi-tenant del generador y de la captura sugerida (un tenant no ve ni cita evidencias ni capturas de otro); carga de evidencia de 20 MB por URL firmada desde Heroku; costo medido por documento.
- **Ensayo en copia:** proyecto Supabase temporal con copia de staging (mismo guion del rol auditor), migraciones renumeradas aplicadas dos veces, e2e completos contra la copia, Excel de taxonomía de CLEPSA, Banco Base y Grupo Carso idéntico a la línea base, Grupo Carso intacto, vitrina de un mockup, auditor de Deloitte (cuenta de utilería equivalente) con el panel en lectura, y la prueba de que `main` actual corre sobre la base migrada (intervalo entre migrar y desplegar, y reversión de código).
- **Línea base** en `referencia/lineas-base/v33/`.
- **Despliegue v33:** migraciones primero (las corre una persona), luego `git push heroku main`, verificaciones, registro en §10.
- **Después:** merge de `main` a `dev` si hubo cambios durante el ciclo; limpieza del proyecto de ensayo y de la app de dev si no se conserva; actualización de `README-SCHEMA.md` y de los manuales si cambió algo visible.

No incluye:
- MFA (a la cola hasta que un cliente lo pida).
- Encender el generador o la captura sugerida para clientes reales.
- Rotación de las 124 cuentas de mockups (ventana aparte).
- Cambios funcionales nuevos: lo que no está en `dev` hoy no entra en este encargo.

## 3. Decisiones de configuración al desplegar

| Emisora | `vitrina_habilitada` | generador (documentos) | `lectura_evidencias_activa` |
|---|---|---|---|
| Mockups (17) | como está (AINDA apagada) | encendido, tope por `generaciones_mes_max` | encendida, tope 500 |
| Empresa Demo (staging) | encendida | encendido | encendida |
| Grupo Carso | apagada | **apagado** hasta contrato que nombre a Anthropic | **apagada** |
| CLEPSA (mockup hasta kick off) | encendida | encendido | encendida; al kick off, el tenant real nace apagado |

El generador necesita una bandera por tenant si hoy no la tiene; si no existe, se añade en este encargo (aditiva, default apagado para `es_demo = false`).

## 4. Definición de terminado

- Migraciones renumeradas: aplicación limpia en local idéntica en esquema a la aplicación histórica; `migration list` local == dev == ensayo tras aplicar.
- Verificaciones previas sobre staging documentadas con sus consultas y resultados.
- A8 ejecutado desde Heroku con tiempos y costos en §7; aislamiento multi-tenant probado con rechazo del servidor, no por pantalla.
- Ensayo en copia verde en todos sus puntos; línea base guardada.
- Despliegue v33: migraciones aplicadas (N de N, barrera 81), release arriba con el hash del merge, Excel de las tres emisoras idéntico a la línea base, Grupo Carso intacto, logs sin errores, vitrina de un mockup, Cobertura en Carso sin botón de suplemento ni de lectura.
- Banderas por emisora conforme a §3, verificadas por consulta.
- Registro en especificación §10 y en §7 de este encargo; `README-SCHEMA.md` al día; manuales actualizados si cambió algo visible para el cliente.
- Reversión documentada: `heroku releases:rollback v32 -a traceline-staging`; las migraciones se quedan (aditivas y probadas con `main` sobre la base migrada).

## 5. Pasos y paradas

0. Resumen de una página: inventario de lo que `dev` tiene y staging no (migraciones, tablas, rutas, pantallas, banderas, dependencias de `package.json`), propuesta de renumeración con la lista de archivos antes/después, riesgos que ves. Parada.
1. Renumeración en `dev/ajustes-sep26` y verificación de esquema. Parada.
2. Verificaciones previas sobre staging (solo lectura) y decisión de `service_role`. Parada con resultados.
3. Proyecto de ensayo (Esteban lo crea y pasa el ref; copia por el script con las URL en su terminal) y A8 en `traceline-dev` apuntando a ensayo. Parada con tiempos, costos y aislamiento.
4. Ensayo completo en copia, línea base, informe. Parada.
5. PR de `dev/ajustes-sep26` a `main`, revisado con el asesor. Guion v33 en §5.1 con los comandos exactos. Parada.
6. Despliegue v33: merge y push por Claude Code (CLAUDE.md v1.6/v1.7), migraciones por Esteban antes del push, verificaciones, banderas, registro. Limpieza.

## 6. Riesgos

- Renumerar migraciones ya aplicadas en dev y en los proyectos de los colaboradores: dev y el proyecto de Quique (si existe) deberán marcarse con `migration repair` o recrearse; se documenta el procedimiento.
- El generador y la captura sugerida en dyno real: `after()` y los tiempos de bloque pueden comportarse distinto que en local; A8 existe para eso.
- Banderas: un tenant real con el generador encendido por error enviaría sus datos a la API de Anthropic sin contrato; la verificación por consulta de §4 es obligatoria antes de dar por terminado.
- El límite de 25 MB del bucket es restrictivo; se verifica antes que ninguna evidencia existente lo supere.
- Conflictos conocidos ya resueltos en `dev` (`suplemento-button`, `cobertura-view`, `.gitignore`); pueden aparecer otros si `main` cambió desde el último merge a `dev`.

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-10-05 | Encargo escrito; MFA queda en cola | Renumerar migraciones en lugar de `--include-all`; Carso con generador y lectura apagados hasta contrato |
