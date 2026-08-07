"use client";

import { useEffect, useMemo, useState } from "react";

type Med = { name: string; presentation: string; monthlyQty: string };
type Protocol = { id: string; name: string; cid10?: string | null; medications: Med[] };

const STEPS = [
  "Paciente",
  "Categoria",
  "Medicamento",
  "Diagnóstico e CID",
  "Dose",
  "Exames",
  "Justificativa",
  "Revisão",
];

/**
 * Assistente de LME em 8 etapas. Reaproveita os protocolos cadastrados e a API
 * de LME existente. Ao finalizar, gera a LME (e opcionalmente a receita).
 */
export function LmeWizard({
  emailParam,
  patientName,
  onCreated,
}: {
  emailParam: string;
  patientName?: string;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [protocolId, setProtocolId] = useState("");
  const [meds, setMeds] = useState<Med[]>([{ name: "", presentation: "", monthlyQty: "" }]);
  const [form, setForm] = useState({
    weightKg: "",
    heightCm: "",
    cid10: "",
    diagnosis: "",
    posologia: "",
    exames: "",
    justificativa: "",
  });
  const [alsoReceita, setAlsoReceita] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/protocols")
      .then((r) => (r.ok ? r.json() : { protocols: [] }))
      .then((d) => setProtocols(d.protocols || []))
      .catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function applyProtocol(id: string) {
    setProtocolId(id);
    const p = protocols.find((x) => x.id === id);
    if (!p) return;
    if (p.cid10) set("cid10", p.cid10);
    if (p.medications.length) {
      setMeds(p.medications.map((m) => ({ name: m.name || "", presentation: m.presentation || "", monthlyQty: m.monthlyQty || "" })));
    }
  }

  const canAdvance = useMemo(() => {
    if (step === 2) return meds.some((m) => m.name.trim());
    if (step === 3) return Boolean(form.cid10.trim());
    return true;
  }, [step, meds, form.cid10]);

  async function finish() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/doctor/patients/${emailParam}/lme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightKg: form.weightKg || undefined,
          heightCm: form.heightCm || undefined,
          cid10: form.cid10,
          diagnosis: form.diagnosis,
          anamnesis: form.justificativa,
          medications: meds.filter((m) => m.name.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível gerar a LME.");

      if (alsoReceita) {
        const body = meds
          .filter((m) => m.name.trim())
          .map((m) => `${m.name} ${m.presentation} — ${form.posologia || m.monthlyQty || ""}`.trim())
          .join("\n");
        if (body) {
          await fetch(`/api/doctor/patients/${emailParam}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "receita", body, sharedWithPatient: true }),
          });
        }
      }

      await onCreated();
      if (data.id) window.open(`/lme/${data.id}`, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel space-y-4">
      {/* Progresso */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i <= step ? "bg-[var(--gold)] text-white" : "bg-[var(--border)] text-[var(--text-muted)]"}`}>
              {i + 1}
            </span>
            {i < STEPS.length - 1 && <span className={`mx-1 h-0.5 w-4 ${i < step ? "bg-[var(--gold)]" : "bg-[var(--border)]"}`} />}
          </div>
        ))}
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
        Etapa {step + 1} de 8 — {STEPS[step]}
      </p>

      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-soft)]">Paciente: <strong className="text-[var(--text)]">{patientName || "—"}</strong>. Confira/complete os dados abaixo (opcional).</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso (kg)" value={form.weightKg} onChange={(v) => set("weightKg", v)} />
            <Field label="Altura (cm)" value={form.heightCm} onChange={(v) => set("heightCm", v)} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-soft)]">Escolha um protocolo (preenche CID e medicamentos). Você pode ajustar depois.</p>
          {protocols.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum protocolo cadastrado — preencha manualmente nas próximas etapas.</p>}
          <div className="grid gap-2">
            {protocols.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyProtocol(p.id)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${protocolId === p.id ? "border-[var(--gold)] bg-[var(--gold-soft)]" : "border-[var(--border)]"}`}
              >
                <span className="block font-semibold text-[var(--text)]">{p.name}</span>
                <span className="block text-xs text-[var(--text-muted)]">{p.cid10 ? `CID ${p.cid10} · ` : ""}{p.medications.length} medicamento(s)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          {meds.map((m, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input className="input-field" placeholder="Medicamento (DCB)" value={m.name} onChange={(e) => setMeds((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className="input-field" placeholder="Apresentação" value={m.presentation} onChange={(e) => setMeds((a) => a.map((x, j) => (j === i ? { ...x, presentation: e.target.value } : x)))} />
              <input className="input-field" placeholder="Qtde/mês" value={m.monthlyQty} onChange={(e) => setMeds((a) => a.map((x, j) => (j === i ? { ...x, monthlyQty: e.target.value } : x)))} />
            </div>
          ))}
          <button type="button" className="text-sm font-semibold text-[var(--gold)]" onClick={() => setMeds((a) => [...a, { name: "", presentation: "", monthlyQty: "" }])}>
            + Adicionar medicamento
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <Field label="CID-10" value={form.cid10} onChange={(v) => set("cid10", v)} />
          <Field label="Diagnóstico" value={form.diagnosis} onChange={(v) => set("diagnosis", v)} />
        </div>
      )}

      {step === 4 && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Dose e posologia</span>
          <textarea className="input-field min-h-[100px]" value={form.posologia} onChange={(e) => set("posologia", e.target.value)} placeholder="Ex.: 1 comprimido 2x/dia por 30 dias. Revise a quantidade mensal de cada medicamento na etapa anterior." />
        </label>
      )}

      {step === 5 && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Exames e critérios</span>
          <textarea className="input-field min-h-[100px]" value={form.exames} onChange={(e) => set("exames", e.target.value)} placeholder="Exames comprobatórios e critérios (revise as exigências da Secretaria de Saúde responsável)." />
          <p className="mt-2 text-xs text-[var(--text-muted)]">Revise os critérios e exigências da Secretaria de Saúde. Os requisitos podem variar conforme protocolo, estado e município.</p>
        </label>
      )}

      {step === 6 && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Justificativa</span>
          <textarea className="input-field min-h-[140px]" value={form.justificativa} onChange={(e) => set("justificativa", e.target.value)} placeholder="Justificativa clínica (texto livre)." />
        </label>
      )}

      {step === 7 && (
        <div className="space-y-2 text-sm">
          <p className="text-[var(--text-soft)]"><b>Paciente:</b> {patientName || "—"}</p>
          <p className="text-[var(--text-soft)]"><b>CID:</b> {form.cid10 || "—"} · <b>Diagnóstico:</b> {form.diagnosis || "—"}</p>
          <p className="text-[var(--text-soft)]"><b>Medicamentos:</b> {meds.filter((m) => m.name.trim()).map((m) => `${m.name} ${m.presentation}`.trim()).join("; ") || "—"}</p>
          <p className="text-[var(--text-soft)]"><b>Justificativa:</b> {form.justificativa || "—"}</p>
          <label className="mt-2 flex items-center gap-2 text-[var(--text-soft)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={alsoReceita} onChange={(e) => setAlsoReceita(e.target.checked)} />
            Gerar também a receita dos medicamentos
          </label>
        </div>
      )}

      {error && <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}

      <div className="flex justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Voltar
        </button>
        {step < 7 ? (
          <button type="button" className="btn-gold" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
            Avançar
          </button>
        ) : (
          <button type="button" className="btn-gold" onClick={finish} disabled={saving}>
            {saving ? "Gerando…" : "Gerar LME"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      <input className="input-field" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
