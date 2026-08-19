import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { APP_NAME, IS_STAGING } from "@/lib/app";
import { ToastProvider } from "@/components/ui/toast";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} · Portal de evidencia ESG`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Portal de recabado y trazabilidad de evidencia de sostenibilidad (NIIF S1/S2).",
  // Sin dominio propio, este despliegue no debe aparecer en buscadores. Es global
  // a propósito: no depende de qué tenant tenga la sesión (ni de si hay sesión).
  ...(IS_STAGING ? { robots: { index: false, follow: false } } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${sora.variable} ${inter.variable}`}>
      <body className="antialiased">
        {/* La franja de demostración NO va aquí: este layout no sabe de qué
            tenant es la sesión (y en /login no hay ninguna). La montan los
            layouts autenticados, que ya resuelven el tenant. */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
