import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/app";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${sora.variable} ${inter.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
