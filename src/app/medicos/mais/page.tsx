"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Item = { href: string; label: string; desc: string; external?: boolean };
type Group = { title: string; items: Item[] };

export default function MedicoMaisPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
      fetch("/api/admin/session").then((r) => r.json()).then((x) => setIsAdmin(Boolean(x.admin))).catch(() => {});
    });
  }, [router]);

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/medicos/login");
  }

  if (!ready) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  const groups: Group[] = [
    {
      title: "Financeiro",
      items: [
        { href: "/medicos/painel#financeiro", label: "Financeiro", desc: "Recebido, pendente, valor da consulta e repasse." },
      ],
    },
    {
      title: "Clínica e equipe",
      items: [
        { href: "/medicos/agenda/configurar", label: "Clínicas e horários", desc: "Locais de atendimento e períodos da agenda." },
        { href: "/medicos/equipe", label: "Atendentes", desc: "Sua equipe administrativa e permissões." },
        { href: "/medicos/equipe-assistencial", label: "Minha Equipe", desc: "Nutrição, psicologia e enfermagem." },
        { href: "/medicos/equipe-nutricao", label: "Equipe de Nutrição", desc: "Permissões detalhadas das nutricionistas." },
      ],
    },
    {
      title: "Documentos e pesquisa",
      items: [
        { href: "/medicos/documentos", label: "Documento avulso", desc: "Receita, pedido ou relatório rápido sem paciente." },
        { href: "/medicos/configuracoes/documentos", label: "Papéis timbrados", desc: "Modelos de papel timbrado para os PDFs." },
        { href: "/medicos/pesquisa", label: "Estudos e Pesquisa", desc: "Casos, estudos, análises e exportação científica." },
        { href: "/medicos/links", label: "Links úteis", desc: "Sua biblioteca de links por condição." },
      ],
    },
    {
      title: "Conta",
      items: [
        { href: "/medicos/configuracoes", label: "Configurações", desc: "Perfil, notificações, CNS e preferências." },
        ...(isAdmin ? [{ href: "/admin", label: "Administração", desc: "Área administrativa da plataforma.", external: true }] : []),
      ],
    },
  ];

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]">Médico</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Mais</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Todas as áreas do Meu Rim, organizadas. O dia a dia fica no Painel, Pacientes e Agenda.</p>

          {groups.map((g) => (
            <section key={g.title} className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{g.title}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {g.items.map((it) => (
                  <Link key={it.href + it.label} href={it.href} className="panel block transition hover:border-[var(--border-gold)]">
                    <p className="font-display text-lg font-bold text-[var(--text)]">{it.label}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{it.desc}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <div className="mt-8">
            <button type="button" className="btn-ghost" onClick={logout}>Sair</button>
          </div>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
