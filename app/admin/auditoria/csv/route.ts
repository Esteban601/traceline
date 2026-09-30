import { NextResponse, type NextRequest } from "next/server";
import { getPerfilActual, esAdminIrstrat } from "@/lib/data";
import { leerActividad, TIPO_LABEL } from "@/lib/auditoria-vista";
import { fmtFechaHora } from "@/lib/fechas";

/**
 * CSV de la actividad de auditores, con los filtros de la pantalla.
 *
 * EXPORTA EL REGISTRO CRUDO, fila por fila, SIN la agrupación de la línea de
 * tiempo. La agrupación existe para que una persona pueda leer la pantalla; un
 * CSV que se lleva agrupado ya no serviría para reconstruir lo que pasó, que es
 * para lo que se exporta.
 */
function campo(v: string | null | undefined): string {
  const s = v ?? "";
  // Excel en es-MX abre CSV con punto y coma; se escapan comillas duplicándolas.
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const perfil = await getPerfilActual();
  if (!perfil) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!esAdminIrstrat(perfil)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const q = req.nextUrl.searchParams;
  const actos = await leerActividad(
    {
      tenantId: q.get("tenant"),
      auditorId: q.get("auditor"),
      desde: q.get("desde"),
      hasta: q.get("hasta"),
    },
    20000
  );

  const encabezado = [
    "Fecha y hora",
    "Emisora",
    "Auditor",
    "Acción",
    "Tipo de objeto",
    "Id del objeto",
    "Archivo",
    "IP",
    "Navegador",
  ];

  const lineas = [
    encabezado.join(";"),
    ...actos.map((a) =>
      [
        campo(fmtFechaHora(a.createdAt)),
        campo(a.tenantNombre),
        campo(a.auditorNombre),
        campo(TIPO_LABEL[a.tipo]),
        campo(a.objetoTipo),
        campo(a.objetoId),
        campo(a.archivo),
        campo(a.ip),
        campo(a.navegador),
      ].join(";")
    ),
  ];

  const hoy = new Date().toISOString().slice(0, 10);
  // BOM para que Excel reconozca UTF-8 y no destroce los acentos.
  const cuerpo = "﻿" + lineas.join("\r\n") + "\r\n";

  return new NextResponse(cuerpo, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="actividad-auditores-${hoy}.csv"`,
    },
  });
}
