"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hideDemo =
    pathname?.startsWith("/consulta") || pathname?.startsWith("/confirmacao");

  return (
    <>
      {!hideDemo && (
        <div className="border-b border-[var(--border-gold)] bg-[rgba(201,169,97,0.1)] px-4 py-2 text-center text-xs font-semibold text-[var(--gold-light)]">
          Modo demonstração — pagamentos e e-mails são simulados.{" "}
          <Link href="/amanha" className="underline underline-offset-2 hover:text-[var(--text)]">
            Ver o que falta para amanhã
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-50 border-b border-white/[0.04] bg-[#050505]/74 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] text-lg font-extrabold text-[#101010] shadow-[var(--shadow-gold)]">
              R
            </span>
            <span className="font-display text-[25px] leading-none text-[var(--text)]">
              Meu <span className="text-[var(--gold)]">Rim</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-2 text-sm font-semibold sm:flex sm:gap-3">
            <Link
              href="/agendar?rapido=1"
              className="rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] px-4 py-2.5 text-[#111] shadow-[var(--shadow-gold)] transition hover:-translate-y-0.5"
            >
              Consulta online
            </Link>
            <Link
              href="/medicos/login"
              className="rounded-full border border-[var(--border-gold)] px-4 py-2.5 text-[var(--gold-light)] transition hover:-translate-y-0.5"
            >
              Sou médico
            </Link>
          </nav>

          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] text-[var(--gold-light)] sm:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="text-xl leading-none">{open ? "×" : "☰"}</span>
          </button>
        </div>

        {open && (
          <div className="border-t border-white/[0.04] px-5 py-4 sm:hidden">
            <div className="flex flex-col gap-2">
              <Link
                href="/agendar?rapido=1"
                className="btn-gold w-full"
                onClick={() => setOpen(false)}
              >
                Consulta online
              </Link>
              <Link
                href="/medicos/login"
                className="btn-ghost w-full"
                onClick={() => setOpen(false)}
              >
                Sou médico
              </Link>
              <Link
                href="/educacao"
                className="rounded-full px-4 py-3 text-center text-sm font-semibold text-[var(--text-soft)]"
                onClick={() => setOpen(false)}
              >
                Educação renal
              </Link>
              <Link
                href="/amanha"
                className="rounded-full px-4 py-3 text-center text-sm font-semibold text-[var(--gold-light)]"
                onClick={() => setOpen(false)}
              >
                Checklist amanhã
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
