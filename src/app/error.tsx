"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
        Algo falhou
      </p>
      <h1 className="font-display mt-3 text-3xl text-[var(--text)]">
        Não conseguimos abrir esta página
      </h1>
      <p className="mt-3 text-sm text-[var(--text-muted)]">
        {error.message || "Erro inesperado. Tente de novo."}
      </p>
      <button type="button" className="btn-gold mt-8" onClick={reset}>
        Tentar novamente
      </button>
    </div>
  );
}
