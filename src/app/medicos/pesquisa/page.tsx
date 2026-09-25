"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { STUDY_TYPE_LABEL, STUDY_STATUS_LABEL, studyNextAction, studyBucket, type StudyLite } from "./studyMeta";

type CaseLite = { id: string; patientName: string; categories: string[]; updatedAt: string };

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

  const rascunhos = studies.filter((s) => studyBucket(s.status) === "rascunho");
  const andamento = studies.filter((s) => studyBucket(s.status) === "andamento");
  const concluidos = studies.filter((s) => studyBucket(s.status) === "concluido");

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
            <div className="flex flex-wrap gap-2">
              <Link href="/medicos/pesquisa/estudos" className="btn-ghost">Meus estudos</Link>
              <Link href="/medicos/pesquisa/estudos" className="btn-gold">+ Novo estudo</Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric n={cases.length} label="Casos interessantes" />
            <Metric n={studies.length} label="Estudos" />
            <Metric n={andamento.length} label="Em andamento" />
            <Metric n={concluidos.length} label="Concluídos" />
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Meus estudos</p>
                <h2 className="font-display text-xl font-extrabold text-[var(--text)]">Lista dos estudos</h2>
              </div>
              <Link href="/medicos/pesquisa/estudos" className="text-sm font-semibold text-[var(--gold)]">Ver todos →</Link>
            </div>
            {studies.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">Nenhum estudo ainda. Crie o primeiro em “+ Novo estudo”.</p>
            ) : (
              <div className="mt-4 space-y-5">
                <StudyGroup title="Rascunhos" items={rascunhos} />
                <StudyGroup title="Em andamento" items={andamento} />
                <StudyGroup title="Concluídos" items={concluidos} />
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link href="/medicos/pesquisa/casos" className="panel block transition hover:border-[var(--border-gold)]">
              <p className="font-display text-lg font-bold text-[var(--text)]">Casos interessantes</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Pacientes marcados para estudo, aula ou relato.</p>
            </Link>
            <Link href="/medicos/pesquisa/ideias" className="panel block transition hover:border-[var(--border-gold)]">
              <p className="font-display text-lg font-bold text-[var(--text)]">Ideias encontradas</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Sugestões de estudo a partir dos seus dados reais.</p>
            </Link>
            <Link href="/medicos/pesquisa/coorte" className="panel block transition hover:border-[var(--border-gold)]">
              <p className="font-display text-lg font-bold text-[var(--text)]">Construtor de coortes</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Filtre pacientes e gere estatística descritiva.</p>
            </Link>
            <Link href="/medicos/pesquisa/dicionario" className="panel block border-dashed transition hover:border-[var(--border-gold)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Atalho</p>
              <p className="font-display text-lg font-bold text-[var(--text)]">Dicionário de dados</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Definição de cada variável do banco.</p>
            </Link>
          </div>

          <p className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--gold-soft)]/40 px-4 py-3 text-xs text-[var(--text-muted)]">
            Privacidade e ética: o banco científico é anonimizado (P0001…) e separado dos dados identificáveis do prontuário.
            A anonimização não substitui consentimento, aprovação de CEP/CONEP quando aplicável, nem autorização para uso de imagens.
            Cada médico vê apenas os seus próprios pacientes e estudos. Exportar arquivo exige governança (CEP ou dispensa).
          </p>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

function StudyGroup({ title, items }: { title: string; items: StudyLite[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{title}</p>
      <div className="mt-2 grid gap-2">
        {items.map((s) => {
          const next = studyNextAction(s.status);
          const updated = s.updatedAt || s.createdAt;
          return (
            <Link key={s.id} href={`/medicos/pesquisa/estudos/${s.id}`} className="panel flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--text)]">{s.title || "Sem título"}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {STUDY_TYPE_LABEL[s.type] || s.type} · {STUDY_STATUS_LABEL[s.status] || s.status}
                  {updated ? ` · atualizado ${new Date(updated).toLocaleDateString("pt-BR")}` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--gold-soft)] px-2.5 py-1 text-xs font-bold text-[var(--gold)]">{next.label}</span>
            </Link>
          );
        })}
      </div>
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
