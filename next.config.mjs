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
};

export default nextConfig;
