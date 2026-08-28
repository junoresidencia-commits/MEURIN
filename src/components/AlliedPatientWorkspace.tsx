"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ClinicalSnapshotCard } from "@/components/ClinicalSnapshotCard";
import { PdModule } from "@/components/PdModule";
import { CareMessageThread } from "@/components/CareMessageThread";
import { fieldsForRole, payloadToBody } from "@/lib/allied-forms";
import { ROLE_META, type AlliedRole } from "@/lib/allied-types";

type Note = {
  id: string; kind: string; title?: string | null; body: string; payload: Record<string, unknown>;
  shareWithTeam: boolean; createdAt: string; professionalName: string; registry?: string | null; updatedAt: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AlliedPatientWorkspace({ role }: { role: AlliedRole }) {
  const router = useRouter();
  const params = useParams<{ key: string }>();
  const key = decodeURIComponent(Array.isArray(params.key) ? params.key[0] : params.key);
  const base = ROLE_META[role].path;
  const registryLabel = ROLE_META[role].registry;
  const fields = fieldsForRole(role);

  const [patient, setPatient] = useState<{ name: string; key: string } | null>(null);
  const [snapshot, setSnapshot] = useState<Parameters<typeof ClinicalSnapshotCard>[0]["snapshot"] | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isPd, setIsPd] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("resumo");
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [evolucao, setEvolucao] = useState("");
  const [condutas, setCondutas] = useState("");
  const [orientacoes, setOrientacoes] = useState("");
  const [share, setShare] = useState(ROLE_META[role].shareByDefault);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/allied/patients/${encodeURIComponent(key)}`).then(async (r) => {
      if (r.status === 401) { router.replace(`${base}/login`); return; }
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Sem acesso a este paciente."); return; }
      setPatient(d.patient);
      setSnapshot(d.snapshot);
      setNotes(d.notes || []);
      setIsPd(Boolean(d.isPd));
    });
  }, [key, base, router]);

  const tabs = useMemo(() => {
    if (role === "psychology") return [
      { id: "resumo", label: "Resumo" },
      { id: "meds", label: "Medicamentos" },
      { id: "anamnese", label: "Minha Anamnese" },
      { id: "evolucoes", label: "Minhas Evoluções" },
    ];
    if (isPd) return [
      { id: "resumo", label: "Resumo" },
      { id: "dp", label: "DP" },
      { id: "cateter", label: "Cateter" },
      { id: "controle", label: "Controle" },
      { id: "treino", label: "Treinamento" },
      { id: "evolucoes", label: "Evoluções" },
    ];
    return [
      { id: "resumo", label: "Resumo" },
      { id: "exames", label: "Exames" },
      { id: "meds", label: "Medicamentos" },
      { id: "anamnese", label: "Avaliação" },
      { id: "evolucoes", label: "Evoluções" },
    ];
  }, [role, isPd]);

  async function saveNote(kind: "anamnese" | "avaliacao" | "evolucao", extra: Record<string, unknown> = {}) {
    setSaving(true); setMsg("");
    try {
      const bodyText = kind === "evolucao"
        ? [evolucao, condutas && `Condutas: ${condutas}`, orientacoes && `Orientações: ${orientacoes}`].filter(Boolean).join("\n")
        : payloadToBody(fields, payload);
      const res = await fetch(`/api/allied/patients/${encodeURIComponent(key)}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, body: bodyText, payload: kind === "evolucao" ? extra : payload,
          shareWithTeam: share, title: kind === "evolucao" ? "Evolução" : ROLE_META[role].assessmentTitle,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível salvar.");
      setNotes((n) => [d.note, ...n]);
      setMsg("Registro salvo.");
      if (kind === "evolucao") { setEvolucao(""); setCondutas(""); setOrientacoes(""); }
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <p className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-[var(--danger)]">{error}</p>
        <Link href={`${base}/painel`} className="btn-ghost mt-6 inline-flex">Voltar</Link>
      </div>
    );
  }
  if (!patient || !snapshot) return <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  const anamneses = notes.filter((n) => n.kind === "anamnese" || n.kind === "avaliacao");
  const evolucoes = notes.filter((n) => n.kind === "evolucao");

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href={`${base}/painel`} className="text-sm font-semibold text-[var(--gold)]">← Meus Pacientes</Link>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">{patient.name}</h1>
      <p className="text-sm text-[var(--text-muted)]">Dados clínicos já existentes no Meu Rim — sem preencher de novo.</p>

      <section className="panel mt-4">
        <h2 className="font-display text-lg text-[var(--text)]">Mensagens com o paciente</h2>
        <p className="text-sm text-[var(--text-muted)]">O paciente vê você na área dele e pode escrever por aqui. Chega alerta no sino.</p>
        <CareMessageThread role={role} patientKey={patient.key} viewer="professional" />
      </section>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${tab === t.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}>{t.label}</button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {tab === "resumo" && <ClinicalSnapshotCard snapshot={snapshot} showLabs={ROLE_META[role].showLabs} />}
        {tab === "exames" && <ClinicalSnapshotCard snapshot={snapshot} showLabs />}
        {tab === "meds" && (
          <div className="panel">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Medicamentos</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{snapshot.medications || "—"}</p>
          </div>
        )}
        {(tab === "anamnese") && (
          <div className="panel space-y-3">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{f.label}</span>
                <textarea className="input-field min-h-[64px]" value={payload[f.key] || ""} onChange={(e) => setPayload({ ...payload, [f.key]: e.target.value })} />
              </label>
            ))}
            {role === "psychology" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={share} onChange={(e) => setShare(e.target.checked)} />
                Compartilhar com equipe assistencial
              </label>
            )}
            <button type="button" className="btn-gold" onClick={() => saveNote(role === "psychology" ? "anamnese" : "avaliacao")} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
            {anamneses.map((n) => (
              <div key={n.id} className="rounded-xl border border-[var(--border)] p-3 text-sm">
                <p className="text-xs font-bold text-[var(--gold)]">{fmt(n.createdAt)} · {n.professionalName} {n.registry ? `· ${registryLabel} ${n.registry}` : ""}</p>
                <p className="mt-1 whitespace-pre-wrap text-[var(--text-soft)]">{n.body}</p>
              </div>
            ))}
          </div>
        )}
        {tab === "evolucoes" && (
          <div className="panel space-y-3">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Evolução</span><textarea className="input-field min-h-[120px]" value={evolucao} onChange={(e) => setEvolucao(e.target.value)} /></label>
            {ROLE_META[role].hasCondutas && (
              <>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Condutas</span><textarea className="input-field min-h-[70px]" value={condutas} onChange={(e) => setCondutas(e.target.value)} /></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Orientações</span><textarea className="input-field min-h-[70px]" value={orientacoes} onChange={(e) => setOrientacoes(e.target.value)} /></label>
              </>
            )}
            {role === "psychology" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={share} onChange={(e) => setShare(e.target.checked)} />
                Compartilhar com equipe assistencial
              </label>
            )}
            <button type="button" className="btn-gold" onClick={() => saveNote("evolucao")} disabled={saving}>{saving ? "Salvando…" : "Registrar evolução"}</button>
            {evolucoes.map((n) => (
              <div key={n.id} className="rounded-xl border border-[var(--border)] p-3 text-sm">
                <p className="text-xs font-bold text-[var(--gold)]">{fmt(n.createdAt)} · {n.professionalName} {n.registry ? `· ${registryLabel} ${n.registry}` : ""}</p>
                <p className="mt-1 whitespace-pre-wrap text-[var(--text-soft)]">{n.body}</p>
              </div>
            ))}
          </div>
        )}
        {(tab === "dp" || tab === "cateter" || tab === "controle" || tab === "treino") && isPd && (
          <PdModule patientKey={patient.key} labs={snapshot.labs} />
        )}
      </div>
      {msg && <p className="mt-3 text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
    </div>
  );
}
