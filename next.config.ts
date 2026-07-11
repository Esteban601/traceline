import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs se resuelve desde node_modules en runtime (no se bundlea). Su ruta de
  // LECTURA de .xlsx arrastra deps de descompresión (unzipper→fstream→rimraf) que
  // el bundler del servidor no puede externalizar bien con pnpm; sin esto, el
  // route handler que carga la plantilla (wb.xlsx.load) truena en runtime.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
