import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">404</p>
      <h1 className="font-display mt-3 text-3xl text-[var(--text)]">Página não encontrada</h1>
      <p className="mt-3 text-sm text-[var(--text-muted)]">
        Esse link não existe ou a consulta já expirou.
      </p>
      <Link href="/" className="btn-gold mt-8 inline-flex">
        Ir para o início
      </Link>
    </div>
  );
}
