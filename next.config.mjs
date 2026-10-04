/** @type {import('next').NextConfig} */
const nextConfig = {
  // exceljs se resuelve desde node_modules en runtime (no se bundlea). Su ruta de
  // LECTURA de .xlsx arrastra deps de descompresión (unzipper→fstream→rimraf) que
  // el bundler del servidor no puede externalizar bien; sin esto, el route handler
  // que carga la plantilla (wb.xlsx.load) truena en runtime.
  // Librerías de lectura de evidencias (captura sugerida) fuera del bundle: se
  // cargan de node_modules en el servidor, como exceljs. sharp ya lo trata así
  // Next por defecto.
  serverExternalPackages: ["exceljs", "unpdf", "mammoth", "heic-convert", "pdf-lib"],
  // La subida de evidencias pasa por una server action. El límite por defecto de
  // Next es 1 MB y rechazaba cualquier archivo mayor con un error genérico
  // (hotfix v32). 26 MB = los 25 MB de la evidencia más el resto del formulario;
  // el límite de 25 MB lo comprueban el cliente y la acción
  // (lib/evidencias/limite-subida.ts). Clave verificada en Next 15.5.20:
  // ExperimentalConfig.serverActions.bodySizeLimit.
  experimental: {
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
