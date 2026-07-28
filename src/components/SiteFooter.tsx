import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.04] px-5 py-10 text-center text-sm text-[var(--text-muted)]">
      <p className="font-display text-lg text-[var(--gold-light)]">Meu Rim</p>
      <p className="mt-2">Teleconsulta de nefrologia · Pagamento direto ao médico · Sala online própria</p>
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <Link href="/agendar" className="hover:text-[var(--gold-light)]">
          Agendar
        </Link>
        <Link href="/medicos/cadastro" className="hover:text-[var(--gold-light)]">
          Cadastrar médico
        </Link>
        <Link href="/educacao" className="hover:text-[var(--gold-light)]">
          Educação renal
        </Link>
      </div>
    </footer>
  );
}
