"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function BrandMark() {
  return (
    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] shadow-[var(--shadow-gold)]">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
        <path
          d="M9 3C5.7 3 4 6 4 9.5 4 13.6 6.4 16.5 9 16.5c1.7 0 2.6-1.2 2.6-3V8C11.6 5 10.8 3 9 3Z"
          fill="#fff"
          opacity="0.95"
        />
        <path
          d="M15 3c3.3 0 5 3 5 6.5 0 4.1-2.4 7-5 7-1.7 0-2.6-1.2-2.6-3V8C12.4 5 13.2 3 15 3Z"
          fill="#fff"
          opacity="0.95"
        />
      </svg>
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Área do paciente e administração têm cara de app próprio, sem o header de marketing.
  if (pathname?.startsWith("/paciente") || pathname?.startsWith("/admin") || pathname?.startsWith("/atendente")) {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <BrandMark />
            <span className="font-display text-[22px] font-extrabold leading-none text-[var(--text)]">
              Meu <span className="text-[var(--gold)]">Rim</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-2 text-sm font-semibold sm:flex sm:gap-3">
            <Link
              href="/agendar"
              className="rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] px-4 py-2.5 text-white shadow-[var(--shadow-gold)] transition hover:-translate-y-0.5"
            >
              Agendar consulta
            </Link>
            <Link
              href="/paciente/entrar"
              className="rounded-full border-[1.5px] border-[var(--border-gold)] px-4 py-2.5 text-[var(--gold)] transition hover:border-[var(--gold)]"
            >
              Já sou paciente
            </Link>
            <Link
              href="/medicos/login"
              className="rounded-full px-3 py-2.5 text-[var(--text-soft)] transition hover:text-[var(--gold)]"
            >
              Sou médico
            </Link>
            <Link
              href="/atendente/login"
              className="rounded-full px-3 py-2.5 text-[var(--text-soft)] transition hover:text-[var(--gold)]"
            >
              Sou atendente
            </Link>
          </nav>

          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--gold)] sm:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="text-xl leading-none">{open ? "×" : "☰"}</span>
          </button>
        </div>

        {open && (
          <div className="border-t border-[var(--border)] px-5 py-4 sm:hidden">
            <div className="flex flex-col gap-2">
              <Link href="/agendar" className="btn-gold w-full" onClick={() => setOpen(false)}>
                Agendar consulta
              </Link>
              <Link
                href="/paciente/entrar"
                className="btn-ghost w-full"
                onClick={() => setOpen(false)}
              >
                Já sou paciente
              </Link>
              <Link
                href="/medicos/login"
                className="rounded-full px-4 py-3 text-center text-sm font-semibold text-[var(--text-soft)]"
                onClick={() => setOpen(false)}
              >
                Sou médico
              </Link>
              <Link
                href="/atendente/login"
                className="rounded-full px-4 py-3 text-center text-sm font-semibold text-[var(--text-soft)]"
                onClick={() => setOpen(false)}
              >
                Sou atendente
              </Link>
              <Link
                href="/educacao"
                className="rounded-full px-4 py-3 text-center text-sm font-semibold text-[var(--text-soft)]"
                onClick={() => setOpen(false)}
              >
                Educação renal
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
