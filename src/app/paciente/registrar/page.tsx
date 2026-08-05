"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PatientNav } from "@/components/PatientNav";

type Kind = "bp" | "glucose" | "weight" | "symptom";

const TABS: { id: Kind; label: string }[] = [
  { id: "bp", label: "Pressão" },
  { id: "glucose", label: "Glicemia" },
  { id: "weight", label: "Peso" },
  { id: "symptom", label: "Sintomas" },
];

export default function RegistrarPage() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("bp");
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/patient/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...form }),
      });
      if (res.status === 401) {
        router.replace("/paciente/entrar?next=/paciente/registrar");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      setSaved(true);
      setForm({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-28 pt-8">
      <Link href="/paciente/inicio" className="text-sm font-semibold text-[var(--gold)]">
        ← Início
      </Link>
      <h1 className="font-display mt-3 text-2xl font-extrabold text-[var(--text)]">
        Registrar dados
      </h1>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setKind(t.id);
              setSaved(false);
              setError("");
            }}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
              kind === t.id
                ? "bg-[var(--gold)] text-white"
                : "border border-[var(--border)] bg-white text-[var(--text-soft)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel mt-5 space-y-4">
        {kind === "bp" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sistólica (máx)">
                <input inputMode="numeric" className="input-field" value={form.systolic || ""} onChange={(e) => set("systolic", e.target.value)} placeholder="120" />
              </Field>
              <Field label="Diastólica (mín)">
                <input inputMode="numeric" className="input-field" value={form.diastolic || ""} onChange={(e) => set("diastolic", e.target.value)} placeholder="80" />
              </Field>
            </div>
            <Field label="Frequência cardíaca (opcional)">
              <input inputMode="numeric" className="input-field" value={form.heartRate || ""} onChange={(e) => set("heartRate", e.target.value)} placeholder="72" />
            </Field>
            <Field label="Momento">
              <select className="input-field" value={form.medContext || ""} onChange={(e) => set("medContext", e.target.value)}>
                <option value="">Selecione</option>
                <option value="antes_medicamento">Antes do medicamento</option>
                <option value="depois_medicamento">Depois do medicamento</option>
              </select>
            </Field>
          </>
        )}

        {kind === "glucose" && (
          <>
            <Field label="Glicemia (mg/dL)">
              <input inputMode="numeric" className="input-field" value={form.glucoseMgDl || ""} onChange={(e) => set("glucoseMgDl", e.target.value)} placeholder="98" />
            </Field>
            <Field label="Contexto">
              <select className="input-field" value={form.glucoseContext || ""} onChange={(e) => set("glucoseContext", e.target.value)}>
                <option value="">Selecione</option>
                <option value="jejum">Jejum</option>
                <option value="pre_refeicao">Antes da refeição</option>
                <option value="pos_refeicao">2h após a refeição</option>
                <option value="outro">Outro</option>
              </select>
            </Field>
          </>
        )}

        {kind === "weight" && (
          <Field label="Peso (kg)">
            <input inputMode="decimal" className="input-field" value={form.weightKg || ""} onChange={(e) => set("weightKg", e.target.value)} placeholder="72,5" />
          </Field>
        )}

        {kind === "symptom" && (
          <Field label="Como você está se sentindo?">
            <textarea
              className="input-field min-h-[120px]"
              value={form.symptoms || ""}
              onChange={(e) => set("symptoms", e.target.value)}
              placeholder="Ex.: edema nas pernas, falta de ar, tontura, urina espumosa..."
            />
          </Field>
        )}

        <Field label="Observação (opcional)">
          <input className="input-field" value={form.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="Alguma nota para a equipe" />
        </Field>

        {error && (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        {saved && (
          <p className="rounded-xl border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-2 text-sm text-[var(--green)]">
            Registro salvo. Ele já aparece no seu resumo e no prontuário do seu médico.
          </p>
        )}

        <button type="button" className="btn-gold w-full" onClick={submit} disabled={loading}>
          {loading ? "Salvando…" : "Salvar registro"}
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
        Em emergência (dor forte, falta de ar intensa, desmaio), procure o
        pronto-socorro.
      </p>

      <PatientNav />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
        {label}
      </span>
      {children}
    </label>
  );
}
