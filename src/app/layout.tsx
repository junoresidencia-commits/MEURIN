import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
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
    default: "Meu Rim — Nefrologia online para todo o Brasil",
    template: "%s · Meu Rim",
  },
  description:
    "Consulta com nefrologista online: interior ou capital, com pressa ou acompanhamento. Pague, receba o link e entre na sala — sem Zoom pago.",
  openGraph: {
    title: "Meu Rim — Nefrologia online para todo o Brasil",
    description:
      "Quando a fila e a distância atrapalham, a consulta chega no celular. Agenda, pagamento e vídeo na mesma plataforma.",
    locale: "pt_BR",
    type: "website",
    siteName: "Meu Rim",
  },
  twitter: {
    card: "summary_large_image",
    title: "Meu Rim — Nefrologia online",
    description:
      "Consulta com nefrologista sem deslocamento. Para o interior, para quem tem pressa, para quem precisa de online de verdade.",
  },
  keywords: [
    "nefrologia online",
    "teleconsulta rim",
    "nefrologista interior",
    "consulta renal online",
    "Meu Rim",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${body.variable} font-sans-body antialiased`}>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
