"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useRef } from "react";
import { safePdfSrc } from "@/lib/print-pdf";

function ImprimirInner() {
  const sp = useSearchParams();
  const src = safePdfSrc(sp.get("src") || "");
  const frameRef = useRef<HTMLIFrameElement>(null);

  const goPrint = useCallback(() => {
    const win = frameRef.current?.contentWindow;
    if (win) {
      try {
        win.focus();
        win.print();
        return;
      } catch {
        /* o diálogo do iframe às vezes é bloqueado — tenta a janela */
      }
    }
    window.print();
  }, []);

  if (!src) {
    return <p className="px-6 py-16 text-[var(--danger)]">Documento inválido para imprimir.</p>;
  }

  return (
    <div className="fixed inset-0 bg-white">
      <div className="print:hidden absolute right-3 top-3 z-10 flex gap-2">
        <button type="button" className="btn-gold" onClick={goPrint}>Imprimir</button>
      </div>
      <iframe
        ref={frameRef}
        title="Documento para imprimir"
        src={src}
        className="h-full w-full border-0"
        onLoad={() => {
          window.setTimeout(goPrint, 400);
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
