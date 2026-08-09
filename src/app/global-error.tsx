"use client";

import { useEffect } from "react";

// Boundary de último recurso (erros no layout raiz). Também nunca mostra erro cru.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro global:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.25rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Não conseguimos abrir o aplicativo</h1>
        <p style={{ marginTop: "0.75rem", color: "#64748b" }}>
          Tivemos um problema temporário. Tente novamente.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            padding: "0.6rem 1.2rem",
            borderRadius: "9999px",
            background: "#0d9488",
            color: "white",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
