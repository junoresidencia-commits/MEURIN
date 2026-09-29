"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useRef } from "react";
import { flattenedSrc } from "@/lib/print-pdf";

function ImprimirInner() {
  const sp = useSearchParams();
  const src = flattenedSrc(sp.get("src") || "");
  const frameRef = useRef<HTMLIFrameElement>(null);

  const goPrint = useCallback(() => {
    const win = frameRef.current?.contentWindow;
    if (win) {
      try {
        win.focus();
        win.print();
      } catch {
        /* Chrome às vezes só imprime pelo ícone do visualizador — o PDF já está na tela. */
      }
    }
  }, []);

  if (!src) {
    return <p className="px-6 py-16 text-[var(--danger)]">Documento inválido para imprimir.</p>;
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white">
      <div className="print:hidden flex shrink-0 items-center justify-end border-b border-[var(--border)] bg-white px-3 py-2">
        <button type="button" className="btn-gold" onClick={goPrint}>
          Imprimir
        </button>
      </div>
      <iframe
        ref={frameRef}
        title="Documento impresso"
        src={src}
        className="min-h-0 w-full flex-1 border-0"
        onLoad={() => {
          window.setTimeout(goPrint, 500);
        }}
      />
    </div>
  );
}

export default function ImprimirPage() {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-[var(--text-muted)]">Abrindo documento…</p>}>
      <ImprimirInner />
    </Suspense>
  );
}
