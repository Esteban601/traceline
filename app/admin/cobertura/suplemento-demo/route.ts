import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import JSZip from "jszip";
import { leerArchivoVitrina } from "@/lib/vitrina";
import { limpiarNombreTenant } from "@/lib/tenants";
import { logEvento } from "@/lib/bitacora";

export const runtime = "nodejs";

// =============================================================================
// Descarga del Suplemento NIIF S1 y S2 del tenant de demostración.
//
// Sirve un archivo de vitrina, no uno generado: el generador vive en la rama de
// desarrollo y no está en producción. Esta ruta existe para que la demostración
// pueda enseñar el entregable final mientras tanto.
//
// Los dos archivos de `assets/vitrina/` son PROVISIONALES a propósito. Los
// definitivos se sustituyen copiando encima, sin tocar código ni desplegar
// nada más: por eso el nombre del archivo en disco es fijo y el nombre que ve
// quien descarga se arma aquí.
//
// El acceso se resuelve contra el REPORTE, no contra un parámetro de tenant: el
// tenant sale del reporte y nadie puede pedir el de otro cambiando la URL.
// =============================================================================

const ARCHIVOS = {
  docx: {
    ruta: "suplemento-demo.docx",
    ext: "docx",
    tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  pdf: {
    ruta: "suplemento-demo.pdf",
    ext: "pdf",
    tipo: "application/pdf",
  },
} as const;

type Formato = keyof typeof ARCHIVOS;

const esFormato = (v: string | null): v is Formato => v === "docx" || v === "pdf";

/** Las dos formas del nombre que trae el documento de muestra. */
const NOMBRE_LARGO = "Empresa Demo, S.A.B. de C.V.";
const NOMBRE_CORTO = "Empresa Demo";

/**
 * Las dos formas, en UNA alternancia y con la larga primero: así la barrida
 * única prefiere siempre el nombre completo sobre el corto que contiene.
 */
const RE_NOMBRES = new RegExp(
  [NOMBRE_LARGO, NOMBRE_CORTO].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "g"
);

/** El nombre entra en un XML: un `&` o un `<` sin escapar rompen el .docx. */
function escaparXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Sin acentos, sin espacios: el nombre viaja en una cabecera HTTP. */
function normalizar(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "emisora"
  );
}

export async function GET(req: Request) {
  const perfil = await getPerfilActual();
  if (!perfil) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(req.url);
  const reporteId = url.searchParams.get("reporte");
  const formato = url.searchParams.get("formato");

  if (!reporteId) {
    return NextResponse.json({ error: "Falta el reporte." }, { status: 400 });
  }
  if (!esFormato(formato)) {
    return NextResponse.json({ error: "Formato desconocido." }, { status: 400 });
  }

  const db = await createClient();

  // RLS ya acota lo que este perfil puede ver; que la fila no aparezca es
  // indistinguible de que no exista, y así debe seguir siendo.
  const { data: reporte } = await db
    .from("reportes")
    .select("id, ejercicio, tenant_id, tenants(slug, nombre, es_demo)")
    .eq("id", reporteId)
    .maybeSingle();

  if (!reporte) {
    return NextResponse.json({ error: "Reporte no encontrado." }, { status: 404 });
  }

  const tenant = reporte.tenants as unknown as {
    slug: string | null;
    nombre: string;
    es_demo: boolean;
  } | null;

  // El botón solo se pinta para emisoras de demostración, pero la puerta no
  // puede ser el botón: quien teclee la URL con otro reporte recibe un 403.
  if (!tenant?.es_demo) {
    return NextResponse.json(
      { error: "Este reporte no es de demostración." },
      { status: 403 }
    );
  }

  const staff = esStaff(perfil);
  const admin = esAdminCliente(perfil) && perfil.tenant_id === reporte.tenant_id;
  if (!staff && !admin) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const archivo = ARCHIVOS[formato];
  /** Nombres que la sustitución no encontró; se reportan en la bitácora. */
  let sinSustituir: string[] = [];

  // Bucket primero, repositorio después. La regla vive en lib/vitrina.ts para
  // que esta ruta y la pantalla que ofrece la opción no puedan discrepar.
  const leido = await leerArchivoVitrina(archivo.ruta);
  if (!leido) {
    // Que falte el archivo de vitrina es un problema del despliegue, no de quien
    // pulsa el botón: se dice así en vez de devolver un 500 mudo.
    return NextResponse.json(
      { error: "El documento de muestra no está disponible en este ambiente." },
      { status: 503 }
    );
  }
  let contenido = leido.contenido;

  // --- Sustitución de nombre, SOLO en el Word -------------------------------
  // VITRINA, Y SE VA. El documento de muestra está redactado para «Empresa
  // Demo»; al enseñárselo a otra emisora, verlo con el nombre de la demo lo
  // vuelve un ejemplo ajeno. Se reemplaza al servirlo, sin tocar el archivo en
  // disco, para que sustituir el definitivo siga siendo copiar encima.
  //
  // ESTO DESAPARECE cuando la emisora genere su propio Suplemento: entonces el
  // documento llevará su denominación formal desde el Perfil del emisor, y
  // reescribir nombres al vuelo pasará de ser un apaño útil a ser una mentira.
  // En staging no hay `perfil_emisor`, y por eso el nombre sale de `tenants`.
  //
  // El PDF se sirve tal cual: sustituir texto dentro de un PDF exige
  // re-tipografiar la línea, y un renglón descuadrado en el documento que se usa
  // para vender es peor que un nombre genérico.
  if (formato === "docx") {
    const destino = limpiarNombreTenant(tenant.nombre);
    try {
      const zip = await JSZip.loadAsync(contenido);
      const parte = zip.file("word/document.xml");
      if (parte) {
        const xml = await parte.async("string");
        // UN SOLO PASE, con la forma larga primero en la alternancia.
        //
        // Dos pases encadenados se muerden la cola cuando el nombre de destino
        // contiene al de origen: «Empresa Demo, S.A.B. de C.V.» → «Empresa Demo
        // SAB» y el segundo pase encuentra «Empresa Demo» DENTRO de lo que
        // acababa de escribir, y deja «Empresa Demo SAB SAB». Con una sola
        // barrida el texto ya sustituido no se vuelve a mirar.
        const salida = xml.replace(RE_NOMBRES, () => escaparXml(destino));

        // ¿Quedó alguna aparición sin tocar? No se busca en la salida —ahí el
        // nombre nuevo puede contener al viejo y daría un falso positivo—, sino
        // comparando el ORIGINAL en crudo con el original sin etiquetas. Si el
        // texto plano tiene más apariciones que el XML, alguna está partida
        // entre dos runs, que es como Word guarda una frase editada a media
        // palabra. No se intenta recomponer —reordenar runs rompe el formato—:
        // se avisa, para que quien prepare el definitivo lo escriba de una vez.
        const plano = xml.replace(/<[^>]*>/g, "");
        for (const n of [NOMBRE_LARGO, NOMBRE_CORTO]) {
          const enCrudo = xml.split(n).length - 1;
          const enPlano = plano.split(n).length - 1;
          if (enPlano > enCrudo) sinSustituir.push(n);
        }
        if (salida !== xml) {
          zip.file("word/document.xml", salida);
          // DEFLATE explícito: `generateAsync` guarda sin comprimir por omisión
          // y el documento pasaba de 39 KB a 324 KB al re-empaquetarlo. Un
          // .docx es un zip, y servir uno ocho veces más gordo por no pedir
          // compresión es tirar ancho de banda del cliente.
          contenido = await zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
          });
        }
      }
    } catch (e) {
      // Que la sustitución falle no debe dejar sin documento a quien lo pidió:
      // se sirve el original y queda dicho en el log.
      console.error("[vitrina] no se pudo sustituir el nombre en el Word:", e);
      sinSustituir = [NOMBRE_LARGO, NOMBRE_CORTO];
    }
  }

  const nombre = `Suplemento_S1S2_${normalizar(tenant.slug ?? tenant.nombre)}_${reporte.ejercicio}.${archivo.ext}`;

  await logEvento(db, {
    tenantId: reporte.tenant_id,
    usuarioId: perfil.id,
    accion: "suplemento_demo_descargado",
    entidad: "reportes",
    entidadId: reporte.id,
    detalle: {
      formato,
      ejercicio: reporte.ejercicio,
      archivo: nombre,
      // Qué nombre se puso y si algo quedó sin sustituir: es lo que delata un
      // documento de muestra mal preparado antes de que lo vea un cliente.
      nombre_sustituido: formato === "docx" ? limpiarNombreTenant(tenant.nombre) : null,
      sin_sustituir: sinSustituir.length ? sinSustituir : null,
      // De dónde salió el archivo. Un documento viejo del repositorio y uno
      // recién subido al bucket producían la misma línea; ahora se distinguen.
      origen: leido.origen,
    },
  });

  return new NextResponse(new Uint8Array(contenido), {
    status: 200,
    headers: {
      "Content-Type": archivo.tipo,
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Content-Length": String(contenido.byteLength),
      // Es un archivo de vitrina que se sustituye en caliente: que nadie lo
      // guarde en caché o la sustitución no se vería.
      "Cache-Control": "no-store",
    },
  });
}
