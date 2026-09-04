"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { encodePatientParam } from "@/lib/user-errors";

type Draft = {
  title: string;
  presentation: string;
  history: string;
  antecedents: string;
  exams: string;
  evolution: string;
  treatment: string;
  outcome: string;
};
type TimelineEv = { date: string; kind: string; text: string };
type Meta = { initials: string; age: number | null; sex: string; categories: string[]; scientificNote: string };

const SECTION_LABEL: Record<keyof Draft, string> = {
  title: "Título",
  presentation: "Apresentação",
  history: "História clínica",
  antecedents: "Antecedentes / comorbidades",
  exams: "Exames (por data)",
  evolution: "Evolução",
  treatment: "Tratamento",
  outcome: "Desfecho",
};
const br = (iso: string) => { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; } };

export default function RelatoCasoPage() {
  const router = useRouter();
  const params = useParams<{ email: string }>();
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;

  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [timeline, setTimeline] = useState<TimelineEv[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
      fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/case-report`)
        .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Erro"); return j; })
        .then((j) => { setDraft(j.draft); setTimeline(j.timeline || []); setMeta(j.meta); })
        .catch((e) => setErr(e.message));
    });
  }, [router, emailParam]);

  function set<K extends keyof Draft>(k: K, v: string) { setDraft((d) => (d ? { ...d, [k]: v } : d)); }

  function copyAll() {
    if (!draft) return;
    const text = (Object.keys(SECTION_LABEL) as (keyof Draft)[]).map((k) => `## ${SECTION_LABEL[k]}\n${draft[k]}`).join("\n\n");
    navigator.clipboard?.writeText(text);
  }

  if (!ready) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]"><Link href={`/medicos/paciente/${emailParam}`} className="hover:underline">Prontuário</Link> › Relato de caso</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Relato de caso (rascunho)</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Montado automaticamente a partir dos dados reais do paciente e de-identificado (iniciais/idade/sexo). Revise tudo antes de exportar ou publicar.</p>

          {err && <p className="mt-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{err}</p>}

          {meta && (
            <div className="panel mt-4 text-sm text-[var(--text-soft)]">
              <b className="text-[var(--text)]">{meta.initials}</b>{meta.age != null ? ` · ${meta.age} anos` : ""} · {meta.sex}
              {meta.categories.length > 0 && <span className="ml-2 text-xs text-[var(--gold)]">[{meta.categories.join(", ")}]</span>}
            </div>
          )}

          {draft && (
            <div className="mt-4 grid gap-3">
              {(Object.keys(SECTION_LABEL) as (keyof Draft)[]).map((k) => (
                <label key={k} className="panel block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{SECTION_LABEL[k]}</span>
                  {k === "title" ? (
                    <input className="input-field" value={draft[k]} onChange={(e) => set(k, e.target.value)} />
                  ) : (
                    <textarea className="input-field min-h-[90px] whitespace-pre-wrap" value={draft[k]} onChange={(e) => set(k, e.target.value)} />
                  )}
                </label>
              ))}
              <button type="button" className="btn-gold w-fit" onClick={copyAll}>Copiar rascunho</button>
            </div>
          )}

          {/* Linha do tempo */}
          <div className="panel mt-6">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Linha do tempo</p>
            {timeline.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Sem eventos registrados.</p>
            ) : (
              <ol className="mt-3 space-y-3 border-l-2 border-[var(--border)] pl-4">
                {timeline.map((ev, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-[var(--gold)]" />
                    <p className="text-xs font-semibold text-[var(--text-muted)]">{br(ev.date)} · {ev.kind}</p>
                    <p className="text-sm text-[var(--text-soft)]">{ev.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <p className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--gold-soft)]/40 px-4 py-3 text-xs text-[var(--text-muted)]">
            Relato de caso exige, em geral, consentimento do paciente e pode requerer aprovação/registro conforme normas locais e da revista. Autorização específica é necessária para uso de imagens.
          </p>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
