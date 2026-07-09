import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { APP_NAME, IS_STAGING } from "@/lib/app";
import { ToastProvider } from "@/components/ui/toast";
import { StagingBanner } from "@/components/staging-banner";

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
  // En staging bloqueamos indexación (datos demo, no debe aparecer en buscadores).
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
        <StagingBanner />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
