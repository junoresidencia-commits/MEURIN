"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AreaBackBar } from "@/components/AreaBackBar";

const NAV = [
  { href: "/plataforma", label: "Visão geral" },
  { href: "/plataforma/saude", label: "Saúde" },
  { href: "/plataforma/prontidao", label: "Prontidão" },
  { href: "/plataforma/clinicas", label: "Clínicas" },
  { href: "/plataforma/usuarios", label: "Usuários" },
  { href: "/plataforma/integridade", label: "Integridade" },
  { href: "/plataforma/auditoria", label: "Auditoria" },
  { href: "/plataforma/metricas", label: "Métricas" },
  { href: "/plataforma/pesquisa", label: "Pesquisa" },
  { href: "/plataforma/planos", label: "Planos SaaS" },
];

export default function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    fetch("/api/plataforma/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.actor?.isSuperAdmin) {
          router.replace("/medicos/painel");
          return;
        }
        setName(d.actor.name);
        setReady(true);
      })
      .catch(() => router.replace("/medicos/login"));
  }, [router]);

  if (!ready) {
    return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando administração…</div>;
  }

  const atHome = pathname === "/plataforma";
  const backHref = atHome ? "/medicos/painel" : "/plataforma";
  const backLabel = atHome ? "Voltar à área médica" : "Voltar";

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <aside className="hidden w-60 shrink-0 border-r border-[var(--border)] bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <Link
            href={backHref}
            className="btn-gold mb-4 inline-flex min-h-11 items-center justify-center px-3 text-sm"
          >
            ← {backLabel}
          </Link>
          <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Administração Meu Rim</p>
          <p className="mt-1 px-2 text-sm font-bold text-[var(--text)]">{name}</p>
          <p className="px-2 text-[11px] text-[var(--text-muted)]">SUPER_ADMIN · separado da área médica</p>
          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  pathname === n.href ? "bg-[var(--gold-soft)] text-[var(--gold)]" : "text-[var(--text-soft)] hover:bg-[var(--gold-soft)]"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <Link href="/medicos/painel" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--gold)]">
            ← Voltar à área médica
          </Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <AreaBackBar href={backHref} label={backLabel} />
        <div className="border-b border-[var(--border)] bg-white px-5 py-3 lg:hidden">
          <div className="flex flex-wrap gap-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold">
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-5 py-8">{children}</div>
      </div>
    </div>
  );
}
