"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPANY } from "@/lib/company";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/paciente") || pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="mt-4 border-t border-[var(--border)] bg-white px-5 py-10 text-center text-sm text-[var(--text-muted)]">
      <p className="font-display text-lg font-extrabold text-[var(--gold)]">Meu Rim</p>
      <p className="mx-auto mt-2 max-w-md">
        Cuidado renal que acompanha você, todos os dias — consulta online,
        acompanhamento e orientações no celular ou computador.
      </p>
      <p className="mt-3 text-xs">
        Não é serviço de emergência. Em urgência, procure atendimento presencial.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2">
        <Link href="/agendar" className="hover:text-[var(--gold)]">
          Agendar
        </Link>
        <Link href="/minhas-consultas" className="hover:text-[var(--gold)]">
          Sou paciente
        </Link>
        <Link href="/medicos/login" className="hover:text-[var(--gold)]">
          Sou profissional
        </Link>
        <Link href="/educacao" className="hover:text-[var(--gold)]">
          Educação
        </Link>
        <Link href="/termos" className="hover:text-[var(--gold)]">
          Termos
        </Link>
        <Link href="/privacidade" className="hover:text-[var(--gold)]">
          Privacidade
        </Link>
        <Link href="/admin/login" className="hover:text-[var(--gold)]">
          Administração
        </Link>
      </div>
      <p className="mx-auto mt-5 max-w-md text-xs text-[var(--text-muted)]">
        Projeto desenvolvido com medidas de segurança e privacidade alinhadas à LGPD.
      </p>
      <p className="mx-auto mt-2 max-w-lg text-[11px] text-[var(--text-muted)]">
        {COMPANY.controllerLine}
      </p>
    </footer>
  );
}
