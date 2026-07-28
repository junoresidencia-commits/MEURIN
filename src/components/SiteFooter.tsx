import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.04] px-5 py-10 text-center text-sm text-[var(--text-muted)]">
      <p className="font-display text-lg text-[var(--gold-light)]">Meu Rim</p>
      <p className="mx-auto mt-2 max-w-md">
        Nefrologia online para o interior, a capital e quem tem pressa —
        pagamento ao médico e sala própria, sem Zoom pago.
      </p>
      <p className="mt-3 text-xs">
        Não é pronto-socorro. Em emergência, procure atendimento presencial.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-4">
        <Link href="/agendar" className="hover:text-[var(--gold-light)]">
          Agendar
        </Link>
        <Link href="/minhas-consultas" className="hover:text-[var(--gold-light)]">
          Minhas consultas
        </Link>
        <Link href="/medicos/cadastro" className="hover:text-[var(--gold-light)]">
          Cadastrar médico
        </Link>
        <Link href="/educacao" className="hover:text-[var(--gold-light)]">
          Educação
        </Link>
        <Link href="/amanha" className="hover:text-[var(--gold-light)]">
          Checklist amanhã
        </Link>
        <Link href="/termos" className="hover:text-[var(--gold-light)]">
          Termos
        </Link>
        <Link href="/privacidade" className="hover:text-[var(--gold-light)]">
          Privacidade
        </Link>
      </div>
    </footer>
  );
}
