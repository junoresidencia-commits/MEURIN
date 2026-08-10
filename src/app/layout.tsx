import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PwaBootstrap } from "@/components/PwaBootstrap";
import "./globals.css";

const display = Inter({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Meu Rim — Cuidado renal onde você estiver",
    template: "%s · Meu Rim",
  },
  description:
    "Prontuário nefrológico, consultas presenciais ou online e acompanhamento renal conectando médico e paciente em um só lugar.",
  openGraph: {
    title: "Meu Rim — Cuidado renal onde você estiver",
    description:
      "Consulte um nefrologista, acompanhe exames e mantenha sua saúde renal organizada. Prontuário + consulta + acompanhamento.",
    locale: "pt_BR",
    type: "website",
    siteName: "Meu Rim",
  },
  twitter: {
    card: "summary_large_image",
    title: "Meu Rim — Cuidado renal onde você estiver",
    description:
      "Consulte. Acompanhe. Entenda melhor sua saúde renal — com prontuário e continuidade do cuidado.",
  },
  keywords: [
    "nefrologia",
    "prontuário nefrológico",
    "acompanhamento renal",
    "teleconsulta rim",
    "nefrologista",
    "Meu Rim",
  ],
  applicationName: "Meu Rim",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Meu Rim",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#087b82",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${body.variable} font-sans-body antialiased`}>
        <PwaBootstrap />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
