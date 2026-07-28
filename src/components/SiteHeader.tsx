import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.04] bg-[#050505]/74 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] text-lg font-extrabold text-[#101010] shadow-[var(--shadow-gold)]">
            R
          </span>
          <span className="font-display text-[25px] leading-none text-[var(--text)]">
            Meu <span className="text-[var(--gold)]">Rim</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold sm:gap-3">
          <Link
            href="/agendar?rapido=1"
            className="rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] px-4 py-2.5 text-[#111] shadow-[var(--shadow-gold)] transition hover:-translate-y-0.5"
          >
            Consulta online
          </Link>
          <Link
            href="/medicos/login"
            className="hidden rounded-full border border-[var(--border-gold)] px-4 py-2.5 text-[var(--gold-light)] transition hover:-translate-y-0.5 sm:inline-flex"
          >
            Sou médico
          </Link>
        </nav>
      </div>
    </header>
  );
}
