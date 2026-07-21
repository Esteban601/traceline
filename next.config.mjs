/** @type {import('next').NextConfig} */
const nextConfig = {
  // exceljs se resuelve desde node_modules en runtime (no se bundlea). Su ruta de
  // LECTURA de .xlsx arrastra deps de descompresión (unzipper→fstream→rimraf) que
  // el bundler del servidor no puede externalizar bien; sin esto, el route handler
  // que carga la plantilla (wb.xlsx.load) truena en runtime.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
