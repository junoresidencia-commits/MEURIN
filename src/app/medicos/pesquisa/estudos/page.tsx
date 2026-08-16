"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { STUDY_TYPE_LABEL, STUDY_TYPES, STUDY_STATUS_LABEL, type StudyLite } from "../studyMeta";

function EstudosInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [ready, setReady] = useState(false);
  const [studies, setStudies] = useState<StudyLite[]>([]);
  const [type, setType] = useState<string>(sp.get("type") || "coorte_retro");
  const [title, setTitle] = useState(sp.get("title") || "");
  const [question, setQuestion] = useState(sp.get("question") || "");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  // Pré-preenchimento vindo de "Ideias encontradas" (?filters=...).
  const presetFilters = (() => {
    try { const raw = sp.get("filters"); return raw ? JSON.parse(raw) : []; } catch { return []; }
  })();

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
      fetch("/api/pesquisa/studies").then((r) => r.json()).then((x) => setStudies(x.studies || [])).catch(() => {});
    });
  }, [router]);

  async function create() {
    setErr("");
    if (!title.trim() && !question.trim()) { setErr("Informe um título ou uma pergunta."); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/pesquisa/studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, question, filters: presetFilters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar estudo.");
      router.push(`/medicos/pesquisa/estudos/${data.study.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro inesperado.");
      setCreating(false);
    }
  }

  if (!ready) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]"><Link href="/medicos/pesquisa" className="hover:underline">Pesquisa Científica</Link> › Estudos</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Meus estudos</h1>

          {/* Novo estudo */}
          <div className="panel mt-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Novo estudo</p>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Tipo</span>
              <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
                {STUDY_TYPES.map((t) => <option key={t} value={t}>{STUDY_TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Qual pergunta você quer responder?</span>
              <textarea className="input-field min-h-[70px]" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex.: Qual o perfil dos pacientes com DRC acompanhados em Irecê e região?" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Título (opcional)</span>
              <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do estudo" />
            </label>
            {presetFilters.length > 0 && (
              <p className="text-xs text-[var(--text-muted)]">Filtros pré-carregados de uma ideia: {presetFilters.length}.</p>
            )}
            {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
            <button type="button" className="btn-gold" onClick={create} disabled={creating}>{creating ? "Criando…" : "Criar estudo"}</button>
          </div>

          {/* Lista */}
          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Estudos</p>
            {studies.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum estudo ainda.</p>
            ) : (
              <div className="mt-2 grid gap-2">
                {studies.map((s) => (
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
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

export default function EstudosPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>}>
      <EstudosInner />
    </Suspense>
  );
}
