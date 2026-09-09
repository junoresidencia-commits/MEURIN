import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Instalar o app",
  description: "Instale o Meu Rim no celular (PWA) ou no Mac (Dock e Meu Rim.app para baixar).",
};

export default function InstalarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
