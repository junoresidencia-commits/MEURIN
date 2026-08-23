"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { KidneyMark } from "@/components/BrandKidney";

type Props = {
  eyebrow?: string;
  title?: string;
  subtitle?: ReactNode;
  back?: { href: string; label?: string };
  /** Coluna mais larga para formulários longos (ex.: cadastro do médico). */
  wide?: boolean;
  /** Mostra o brand lockup "Meu Rim" com o rim. Padrão: true. */
  brand?: boolean;
  children: ReactNode;
};

/** Casca premium para telas de login/cadastro: fundo com gradiente, orbes
 * desfocados, grade sutil, marca e onda inferior. O tom acompanha o tema da
 * área (paciente/médico/nutri/atendente) via variáveis --gold. */
export function AuthShell({ eyebrow, title, subtitle, back, wide, brand = true, children }: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Fundo em camadas */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--gold-soft)] via-[var(--bg)] to-[var(--bg)]" />
        <div className="hero-dots absolute inset-0 opacity-70" />
        <div className="animate-float-slow absolute -left-28 top-4 h-80 w-80 rounded-full bg-[var(--gold)]/18 blur-[110px]" />
        <div className="animate-float absolute -right-24 top-24 h-96 w-96 rounded-full bg-[#13b3bc]/14 blur-[120px]" />
        <div className="absolute -bottom-10 left-1/4 h-72 w-72 rounded-full bg-[var(--gold)]/10 blur-[110px]" />
      </div>

      {/* Onda inferior */}
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 block w-full" viewBox="0 0 1440 140" preserveAspectRatio="none" aria-hidden="true" style={{ height: 120 }}>
        <path d="M0 70 C 240 130, 480 10, 720 50 C 960 90, 1200 20, 1440 70 L1440 140 L0 140 Z" fill="var(--gold-soft)" opacity="0.75" />
        <path d="M0 96 C 260 140, 520 40, 760 78 C 1000 116, 1220 56, 1440 96 L1440 140 L0 140 Z" fill="var(--gold)" opacity="0.08" />
      </svg>

      <div className={`relative z-10 mx-auto flex min-h-screen ${wide ? "max-w-xl" : "max-w-md"} flex-col justify-center px-5 py-10`}>
        {back && (
          <Link href={back.href} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)]">
            ← {back.label || "Voltar"}
          </Link>
        )}

        {brand && (
          <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/70 shadow-[var(--shadow)] ring-1 ring-[var(--border-gold)] backdrop-blur">
              <KidneyMark className="h-7 w-7" />
            </span>
            <span className="font-display text-2xl font-extrabold text-[var(--text)]">meu <span className="text-[var(--gold)]">rim</span></span>
          </Link>
        )}

        {(eyebrow || title || subtitle) && (
          <div className="mb-5 text-center">
            {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{eyebrow}</p>}
            {title && <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">{title}</h1>}
            {subtitle && <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-muted)]">{subtitle}</p>}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
