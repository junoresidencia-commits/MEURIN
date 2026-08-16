"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { STUDY_TYPE_LABEL, STUDY_STATUS_LABEL, type StudyLite } from "./studyMeta";

type CaseLite = { id: string; patientName: string; categories: string[]; updatedAt: string };

const NAV = [
  { href: "/medicos/pesquisa/casos", title: "Casos interessantes", desc: "Pacientes marcados para estudo, aula ou relato." },
  { href: "/medicos/pesquisa/estudos", title: "Meus estudos", desc: "Crie e acompanhe estudos a partir dos seus dados." },
  { href: "/medicos/pesquisa/ideias", title: "Ideias encontradas", desc: "Sugestões de estudo a partir dos seus dados reais." },
  { href: "/medicos/pesquisa/coorte", title: "Construtor de coortes", desc: "Filtre pacientes e gere estatística descritiva." },
  { href: "/medicos/pesquisa/dicionario", title: "Dicionário de dados", desc: "Definição de cada variável do banco." },
];

export default function PesquisaHubPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [studies, setStudies] = useState<StudyLite[]>([]);
  const [cases, setCases] = useState<CaseLite[]>([]);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
      fetch("/api/pesquisa/studies").then((r) => r.json()).then((x) => setStudies(x.studies || [])).catch(() => {});
      fetch("/api/pesquisa/cases").then((r) => r.json()).then((x) => setCases(x.cases || [])).catch(() => {});
    });
  }, [router]);

  if (!ready) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  const ativos = studies.filter((s) => s.status !== "concluido").length;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--gold)]">Produção científica</p>
              <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Pesquisa Científica</h1>
              <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">
                Do caso interessante ao banco de dados, análise e exportação — tudo a partir dos seus próprios pacientes.
                A plataforma organiza e calcula; nunca inventa dados.
              </p>
            </div>
            <Link href="/medicos/pesquisa/estudos" className="btn-gold">+ Novo estudo</Link>
          </div>

          {/* Painel de contadores */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric n={cases.length} label="Casos interessantes" />
            <Metric n={studies.length} label="Estudos" />
            <Metric n={ativos} label="Em andamento" />
            <Metric n={studies.filter((s) => s.status === "concluido").length} label="Concluídos" />
          </div>

          {/* Navegação */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="panel block transition hover:border-[var(--border-gold)]">
                <p className="font-display text-lg font-bold text-[var(--text)]">{n.title}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{n.desc}</p>
              </Link>
            ))}
          </div>

          {/* Estudos em andamento */}
          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Estudos em andamento</p>
            {studies.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum estudo ainda. Crie o primeiro em “+ Novo estudo”.</p>
            ) : (
              <div className="mt-2 grid gap-2">
                {studies.slice(0, 6).map((s) => (
                  <Link key={s.id} href={`/medicos/pesquisa/estudos/${s.id}`} className="panel flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text)]">{s.title || "Sem título"}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{STUDY_TYPE_LABEL[s.type] || s.type} · {STUDY_STATUS_LABEL[s.status] || s.status}</p>
                    </div>
                    <span className="shrink-0 text-sm text-[var(--gold)]">abrir →</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <p className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--gold-soft)]/40 px-4 py-3 text-xs text-[var(--text-muted)]">
            Privacidade e ética: o banco científico é anonimizado (P0001…) e separado dos dados identificáveis do prontuário.
            A anonimização não substitui consentimento, aprovação de CEP/CONEP quando aplicável, nem autorização para uso de imagens.
            Cada médico vê apenas os seus próprios pacientes e estudos.
          </p>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

function Metric({ n, label }: { n: number; label: string }) {
  return (
    <div className="panel text-center">
      <p className="font-display text-3xl font-extrabold text-[var(--text)]">{n}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
