import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Imprimir",
  robots: { index: false, follow: false },
};

export default function ImprimirLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0; }
          html, body, main { margin: 0 !important; padding: 0 !important; background: white !important; }
        }
      `}</style>
      {children}
    </>
  );
}
