#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# ¿La URL de conexión apunta al proyecto Supabase <ref>? (la usa migrar-remoto.sh;
# instrucción operativa del despliegue v40, 13 de octubre de 2026).
#
# Acepta las dos formas de Supabase:
#   · conexión directa:  postgres://postgres:…@db.<ref>.supabase.co:5432/postgres
#   · session pooler:    postgres://postgres.<ref>:…@<región>.pooler.supabase.com:5432/postgres
# El ref tiene que estar en el HOST (directa) o en el USUARIO (pooler, y solo con
# un host del pooler de Supabase): ya no basta con que aparezca en cualquier parte
# de la URL (por ejemplo, en la contraseña). Rechaza también la URL que contenga
# el ref del otro proyecto (<otro>).
#
#   url_apunta_a <url> <ref> <otro>   → 0 si apunta; si no, 1 y en $URL_MOTIVO el
#                                       porqué, con usuario y host (nunca la contraseña).
# -----------------------------------------------------------------------------
url_apunta_a() {
  local url="$1" ref="$2" otro="$3" usuario host
  URL_MOTIVO=""
  if [[ ! "$url" =~ ^postgres(ql)?://([^:@/]+)(:[^@]*)?@([^:/?]+) ]]; then
    URL_MOTIVO="no tiene la forma postgres(ql)://usuario:…@host"
    return 1
  fi
  usuario="${BASH_REMATCH[2]}"; host="${BASH_REMATCH[4]}"
  if [[ -n "$otro" && "$url" == *"$otro"* ]]; then
    URL_MOTIVO="contiene el ref del otro proyecto (${otro}); usuario «${usuario}», host «${host}»"
    return 1
  fi
  if [[ "$host" == "db.$ref.supabase.co" ]]; then return 0; fi
  if [[ "$usuario" == "postgres.$ref" && "$host" == *.pooler.supabase.com ]]; then return 0; fi
  URL_MOTIVO="no apunta a $ref: usuario «${usuario}», host «${host}» (se espera host db.$ref.supabase.co, o usuario postgres.$ref con un host *.pooler.supabase.com)"
  return 1
}
