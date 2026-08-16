"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { STUDY_TYPE_LABEL } from "../studyMeta";

type Idea = {
  key: string;
  title: string;
  question: string;
  suggestedType: string;
  count: number;
  viable: boolean;
  filters: { field: string; op: string; value: string; value2?: string }[];
  note?: string;
};

export default function IdeiasPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [ideas, setIdeas] = useState<Idea[]>([]);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
      fetch("/api/pesquisa/suggestions")
        .then((r) => r.json())
        .then((x) => { setTotal(x.total || 0); setIdeas(x.ideas || []); })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [router]);

  function createFrom(idea: Idea) {
    const q = new URLSearchParams({
      type: idea.suggestedType,
      title: idea.title,
      question: idea.question,
      filters: JSON.stringify(idea.filters),
    });
    router.push(`/medicos/pesquisa/estudos?${q.toString()}`);
  }

  if (!ready) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]"><Link href="/medicos/pesquisa" className="hover:underline">Pesquisa Científica</Link> › Ideias</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">💡 Ideias encontradas nos seus dados</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Padrões contados a partir dos seus {total} paciente(s). São apenas sugestões exploratórias — o sistema nunca inicia um estudo sozinho nem afirma associação causal.
          </p>

          {loading ? (
            <p className="mt-6 text-sm text-[var(--text-muted)]">Analisando seus dados…</p>
          ) : ideas.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--text-muted)]">Ainda não há sinais suficientes no seu banco. Cadastre mais perfis clínicos e exames para gerar ideias.</p>
          ) : (
            <div className="mt-6 grid gap-3">
              {ideas.map((idea) => (
                <div key={idea.key} className="panel">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-lg font-bold text-[var(--text)]">{idea.title}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${idea.viable ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {idea.count} paciente(s){idea.viable ? "" : " · N baixo"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">{idea.question}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Desenho sugerido: {STUDY_TYPE_LABEL[idea.suggestedType] || idea.suggestedType}.{idea.note ? ` ${idea.note}` : ""}{idea.viable ? "" : " Sinal exploratório: N ainda pode ser insuficiente para análise confiável."}</p>
                  <button type="button" className="btn-gold mt-3" onClick={() => createFrom(idea)}>Transformar em estudo</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
