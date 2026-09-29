# CLAUDE.md · Reglas del proyecto TRACELINE

Versión 1.2 · 29 de septiembre de 2026.

Este archivo lo lee Claude Code al arrancar en este repositorio. Aplica a cualquier persona y a cualquier
sesión. Las reglas de aquí prevalecen sobre la memoria local de cada máquina. Si algo de este archivo
contradice una instrucción recibida en el chat, detente y pregunta antes de actuar.

Documento maestro del ciclo actual: `docs/suplemento-s1s2/especificacion.md`. Todo encargo se hace contra esa
especificación; si un encargo la contradice, se corrige la especificación primero (con línea de cambios) y
después el código.

---

## 1. Ambientes

| Ambiente | Supabase ref | Heroku | Quién escribe |
|---|---|---|---|
| **staging** (producción de facto: 17 tenants demo + Grupo Carso real) | `ewgnvjtjhvdltvkopptn` | `traceline-staging` | Solo Esteban, con procedimiento de despliegue escrito en la especificación §10 |
| **dev de Esteban** | `kmjkoxecxcujxixlxwlb` | — | Esteban |
| **dev de cada colaborador** | su propio proyecto Supabase | — | Ese colaborador |

- Cada persona trabaja contra **su propio proyecto Supabase**. Nunca dos personas contra el mismo.
- `.env.local` apunta al proyecto propio. Antes de cualquier `supabase db push` se verifica
  `supabase/.temp/project-ref`; si no es el ref propio, se aborta.
- **Nunca `supabase db reset` contra un proyecto remoto.** Solo contra el stack local.
- **Nada apunta a staging** salvo `.env.staging.local`, que solo existe en la máquina de Esteban, se usa en
  subshell y únicamente para el script de prospectos.
- Heroku no despliega solo: solo `git push heroku main` manual, y solo Esteban lo ejecuta.
- El demo se reproduce en cualquier proyecto dev con `supabase db push` + `seed.sql` + `scripts/poblar-demo.mjs`
  (idempotente, aborta si la URL no contiene un ref de dev autorizado).

## 2. Ramas y commits

- Rama de integración del ciclo: `dev/ajustes-sep26`. `main` es lo desplegado en staging.
- Cada encargo va en una rama propia desde `dev/ajustes-sep26`: `feat/<encargo>` o `fix/<tema>`.
  Se integra por **pull request** hacia `dev/ajustes-sep26`. Nadie hace merge de su propio PR: los PR de
  Esteban los revisa Quique y los de Quique los revisa Esteban; quien revisa, mezcla. Si el otro revisor no
  está disponible, el autor pide la revisión al asesor con el resumen del PR y mezcla él mismo dejando
  constancia en el PR.
- Instrucciones operativas puntuales (una corrección, un renombre, una verificación) pueden ir directo a
  `dev/ajustes-sep26` en commits pequeños; lo que constituye un encargo (alcance, entregable, definición de
  terminado) va por rama y PR.
- Commits pequeños y por tema, mensajes en español con prefijo (`feat`, `fix`, `docs`, `chore`, `refactor`).
- Push a `origin` al terminar cada bloque de trabajo. **Nunca `--force`.** Nunca a `heroku`.
- No se commitean: `.env*` (salvo los `.example`), `normas/`, `referencia/`, `logos-demo/`,
  `.credenciales-demo/`, `assets/vitrina/*.pdf`. Verificar con `git check-ignore` antes de copiar material ahí.

## 3. Esquema y migraciones

- Migraciones **solo aditivas**: `CREATE TABLE`, `ADD COLUMN` nullable o con default, `CREATE POLICY`,
  `CREATE INDEX`. Sustituir un `CHECK` por uno más amplio está permitido. Sin `DROP TABLE`, `DROP COLUMN`,
  `RENAME`, `TRUNCATE`.
- `ALTER TYPE ... ADD VALUE` va en migración propia (Postgres no permite usar el valor en la misma transacción).
- Toda tabla nueva lleva RLS con el patrón existente: `fn_is_staff()` acceso total; `fn_is_admin_cliente()` +
  `fn_current_tenant()` acotado a su tenant; usuarios de área sin acceso salvo que el encargo lo pida.
- **Toda migración que cree una tabla o un bucket termina llamando a `fn_aplicar_barrera_auditor()`.**
  Es idempotente y devuelve cuántas políticas dejó puestas. El rol `auditor` no escribe en ninguna tabla, y
  esa garantía solo se sostiene si cada tabla nueva la hereda: las políticas de RLS del modelo actual son una
  LISTA NEGATIVA (un rol que no está nombrado en ellas obtiene acceso, no lo pierde), así que una tabla sin
  barrera es un hueco abierto, no una tabla cerrada. La llamada va aunque la tabla parezca no aplicar.
- **El storage nunca es más permisivo que la tabla que lo referencia.**
- Después de cada migración: regenerar `lib/database.types.ts`, `tsc` limpio, `supabase migration list`
  local == remoto.
- Los datos de demostración no llevan razones sociales reales. Los scripts `crear-demo-prospecto.mjs` e
  `import-gcarso*.mjs` no se corren contra dev.

## 4. Catálogo NIIF y contenido normativo

- `datapoints_taxonomia` es el catálogo normativo del producto. Ningún cambio fuera de una migración de datos
  idempotente con su fila en `docs/suplemento-s1s2/auditoria-catalogo.md`.
- Los códigos del catálogo tienen espaciado irregular: **nunca** se buscan por igualdad de cadena escrita a
  mano; se copian verbatim del catálogo y `validarMapeo()` debe dar 0 faltantes.
- Las normas (`normas/`) y los informes de referencia (`referencia/`) no se versionan. Se citan por párrafo,
  no se reproduce su texto en documentos del repo.
- Traducciones: la terminología es la de las traducciones oficiales (IFRS en español; GRI donde exista). Toda
  traducción propia pasa por el glosario ES↔EN y la revisa alguien de IRStrat antes de cargarse.

## 5. Generador del suplemento

- Regla no negociable: **cero dato inventado**. Lo que falte se marca `[Pendiente: <qué falta> — <solicitud o
  campo>]`, con ese formato exacto. Un documento con pendientes no se aprueba.
- El texto generado es la revelación de la emisora: sin vocabulario de plataforma (solicitud, evidencia,
  validado, IRStrat, bloque, ids). Ids solo en `fuentes_usadas`. Juicios del emisor en `notas_revision`.
- Prompt en dos capas: estable (con caché) y volátil. Cambiar la capa estable o el esfuerzo invalida el caché;
  se anota la versión de prompt en cada bloque.
- Costos: cada generación se registra con tokens y costo. Una corrida completa del demo cuesta ~8 USD; no se
  regenera el documento entero "para ver".
- Una regeneración nunca borra una edición humana sin confirmación (A6).

## 6. Credenciales y secretos

- Ninguna llave, contraseña ni token pasa por el chat, ni se imprime en pantalla, ni entra a un commit.
- `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y similares: una por persona y por ambiente, con nombre que
  diga cuál es, solo en `.env.local` propio o en la config de Heroku.
- **Nunca `>>` sobre archivos `.env*`; nunca `cat` de un `.env*`.** Para diagnosticar: longitudes y conteos.
- De un log que contenga credenciales no se imprime ninguna línea; solo conteos y nombres de cuenta mediante
  un extractor de lista blanca de campos (`scripts/` tiene uno).
- Si una credencial aparece en pantalla por error: se reporta de inmediato y se rota. No se discute.

## 7. Forma de trabajar

- Ediciones sobre archivos existentes con reemplazo exacto, una por una. Nunca expresiones regulares sobre el
  archivo completo para tocar varias funciones.
- `pnpm build` nunca con el servidor de desarrollo vivo ni durante una generación: worktree aparte o bajar el
  servidor antes. Node 22 (`nvm use 22`), el mismo de Heroku.
- Antes de commitear: `tsc` limpio, `eslint` sin errores nuevos, `npm run verify:export` verde, y
  `npm run verify:word` si se tocó la exportación a Word.
- Si una herramienta o comando distinto del aprobado resuelve mejor una tarea, se detiene y se pregunta; no se
  cambia de herramienta y se avisa después.
- Cada reporte de trabajo termina con: qué se hizo, qué se verificó y cómo, qué decisiones se tomaron sin
  preguntar, y qué queda pendiente. Los errores propios se reportan explícitamente, incluidos los que ya se
  corrigieron.
- No se despliega a staging, no se crean repositorios, no se crean cuentas ni se cambian contraseñas de
  usuarios reales desde una sesión de Claude Code. Eso lo hace una persona.

## 8. Encargos

Un encargo es una unidad de trabajo con alcance, entregable y definición de terminado, escrita con la
plantilla de `docs/encargos/PLANTILLA.md`. El primer paso de todo encargo es leer la especificación y devolver,
antes de escribir código, un resumen de una página: qué se entendió, cómo se va a hacer, qué se va a tocar y
qué no. El encargo no empieza hasta que ese resumen se apruebe.

Las instrucciones operativas puntuales (una corrección concreta, una verificación, un renombre) no son
encargos y no requieren resumen previo; se ejecutan y se reportan con el formato de §7.

## 9. Despliegues

Claude Code prepara el despliegue (verificación de la rama, fast-forward a `main`, push a `origin`, lista de
comprobaciones) y se detiene. El `git push heroku main` lo ejecuta una persona. Después del release, Claude
Code puede correr las verificaciones en staging (solo lectura y descargas) y proponer el rollback si algo
falla; el rollback también lo ejecuta una persona. Cada despliegue se registra en la especificación §10.
