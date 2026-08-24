"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";
import { toFriendlyMessage } from "@/lib/user-errors";

type Med = {
  id: string; name: string; dose: string | null; quantity: string | null; frequency: string | null;
  times: string[]; guidance: string | null; notes: string | null; source: "patient" | "doctor";
  confirmedByDoctor: boolean; status: "active" | "suspended"; suspendReason?: string | null;
};
type Dose = { medicationId: string; medName: string; dose: string | null; time: string; status: "taken" | "missed" | "none"; reason: string | null; reasonText: string | null };
type Reason = { value: string; label: string };
type Data = { date: string; medications: Med[]; doses: Dose[]; reasons: Reason[] };

function SourceBadge({ med }: { med: Med }) {
  if (med.source === "doctor") return <span className="rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--gold)]">Registrado pelo médico</span>;
  if (med.confirmedByDoctor) return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Confirmado pelo médico</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Informado pelo paciente</span>;
}

export default function MedicamentosPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  // dose sendo marcada como "não tomei" (aguardando motivo)
  const [missingFor, setMissingFor] = useState<string | null>(null);
  const [reasonOther, setReasonOther] = useState("");
  // formulário de adicionar
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", dose: "", quantity: "", frequency: "", guidance: "", notes: "" });
  const [times, setTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/patient/medications");
    if (res.status === 401) { router.replace("/paciente/entrar"); return; }
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  async function mark(dose: Dose, status: "taken" | "missed", reason?: string, reasonText?: string) {
    setErr("");
    try {
      const res = await fetch("/api/patient/medications/dose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicationId: dose.medicationId, time: dose.time, date: data?.date, status, reason, reasonText }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Erro"); }
      setMissingFor(null); setReasonOther("");
      await load();
    } catch (e) { setErr(toFriendlyMessage(e, "Não foi possível registrar.")); }
  }

  function addTime() {
    const m = timeInput.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return;
    const t = `${String(Math.min(23, Number(m[1]))).padStart(2, "0")}:${m[2]}`;
    setTimes((prev) => Array.from(new Set([...prev, t])).sort());
    setTimeInput("");
  }

  async function addMed(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Informe o nome do medicamento."); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/patient/medications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, times }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Erro"); }
      setForm({ name: "", dose: "", quantity: "", frequency: "", guidance: "", notes: "" });
      setTimes([]); setShowAdd(false);
      await load();
    } catch (e) { setErr(toFriendlyMessage(e, "Não foi possível salvar.")); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="mx-auto max-w-2xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  const activeMeds = (data?.medications || []).filter((m) => m.status === "active");
  const suspendedMeds = (data?.medications || []).filter((m) => m.status === "suspended");
  const doses = data?.doses || [];

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Meus medicamentos</p>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">O que eu uso e se tomei</h1>
        </div>
        <Link href="/paciente/inicio" className="btn-ghost text-sm">← Início</Link>
      </div>

      {err && <p className="mt-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{err}</p>}

      {/* Controle de hoje */}
      <section className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Hoje {data?.date ? `— ${data.date.split("-").reverse().join("/")}` : ""}</p>
        {doses.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-[var(--border)] bg-white p-4 text-sm text-[var(--text-muted)]">
            Nenhuma dose programada para hoje. Adicione um medicamento com horários abaixo para acompanhar.
          </p>
        ) : (
          <div className="mt-2 grid gap-2">
            {doses.map((dose) => {
              const key = `${dose.medicationId}:${dose.time}`;
              const isMissing = missingFor === key;
              return (
                <div key={key} className={`rounded-2xl border p-3 ${dose.status === "missed" ? "border-[var(--danger)]/40 bg-[var(--danger)]/5" : dose.status === "taken" ? "border-emerald-200 bg-emerald-50/60" : "border-[var(--border)] bg-white"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--text)]"><span className="text-[var(--gold)]">{dose.time}</span> — {dose.medName}{dose.dose ? ` ${dose.dose}` : ""}</p>
                      {dose.status === "missed" && <p className="text-xs text-[var(--danger)]">Não tomou{dose.reason ? ` · ${(data?.reasons || []).find((r) => r.value === dose.reason)?.label || dose.reason}` : ""}</p>}
                      {dose.status === "taken" && <p className="text-xs text-emerald-700">Tomou ✓</p>}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => mark(dose, "taken")} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${dose.status === "taken" ? "bg-emerald-600 text-white" : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>Tomei</button>
                      <button type="button" onClick={() => setMissingFor(isMissing ? null : key)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${dose.status === "missed" ? "bg-[var(--danger)] text-white" : "border border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/5"}`}>Não tomei</button>
                    </div>
                  </div>
                  {isMissing && (
                    <div className="mt-3 rounded-xl border border-[var(--border)] bg-white p-3">
                      <p className="text-xs font-semibold text-[var(--text-soft)]">Por que não tomou?</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(data?.reasons || []).map((r) => (
                          <button key={r.value} type="button"
                            onClick={() => { if (r.value === "outro") return; mark(dose, "missed", r.value); }}
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-soft)] hover:border-[var(--border-gold)] hover:text-[var(--gold)]">
                            {r.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input className="input-field !min-h-[42px] flex-1 text-sm" placeholder="Outro motivo (opcional)" value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} />
                        <button type="button" className="btn-ghost text-sm" onClick={() => mark(dose, "missed", "outro", reasonOther)}>Salvar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Lista de medicamentos + adicionar */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Medicamentos em uso</p>
          <button type="button" className="btn-gold !min-h-[40px] px-4 text-sm" onClick={() => setShowAdd((v) => !v)}>+ Adicionar medicamento que eu uso</button>
        </div>

        {showAdd && (
          <form onSubmit={addMed} className="panel mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome *</span>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Losartana" required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Dose / apresentação</span><input className="input-field" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="Ex.: 50 mg" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Quantidade</span><input className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="Ex.: 1 comprimido" /></label>
            </div>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Frequência</span><input className="input-field" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="Ex.: 2x ao dia" /></label>
            <div className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Horários</span>
              <div className="flex gap-2">
                <input type="time" className="input-field !min-h-[42px] w-36" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} />
                <button type="button" className="btn-ghost text-sm" onClick={addTime}>Adicionar horário</button>
              </div>
              {times.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {times.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-soft)] px-2.5 py-1 text-xs font-bold text-[var(--gold)]">
                      {t}<button type="button" className="text-[var(--danger)]" onClick={() => setTimes(times.filter((x) => x !== t))}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Orientação (opcional)</span><input className="input-field" value={form.guidance} onChange={(e) => setForm({ ...form, guidance: e.target.value })} placeholder="Ex.: em jejum" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Observação (opcional)</span><input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="flex gap-2">
              <button type="submit" className="btn-gold" disabled={saving}>{saving ? "Salvando…" : "Salvar medicamento"}</button>
              <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="mt-3 grid gap-2">
          {activeMeds.length === 0 && !showAdd && <p className="text-sm text-[var(--text-muted)]">Você ainda não cadastrou medicamentos. Toque em “Adicionar medicamento que eu uso”.</p>}
          {activeMeds.map((m) => (
            <div key={m.id} className="rounded-2xl border border-[var(--border)] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--text)]">{m.name}{m.dose ? ` ${m.dose}` : ""}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {m.quantity ? `${m.quantity}` : ""}{m.times.length > 0 ? `${m.quantity ? " · " : ""}${m.times.join(" e ")}` : ""}{m.frequency ? ` · ${m.frequency}` : ""}
                  </p>
                  {m.guidance && <p className="text-xs text-[var(--text-muted)]">{m.guidance}</p>}
                </div>
                <SourceBadge med={m} />
              </div>
            </div>
          ))}
        </div>

        {suspendedMeds.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Suspensos</p>
            <div className="mt-2 grid gap-2">
              {suspendedMeds.map((m) => (
                <div key={m.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft,#f8fafc)] p-3 opacity-80">
                  <p className="font-semibold text-[var(--text-soft)] line-through">{m.name}{m.dose ? ` ${m.dose}` : ""}</p>
                  <p className="text-xs text-[var(--text-muted)]">Suspenso pelo médico{m.suspendReason ? ` · ${m.suspendReason}` : ""}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-[11px] text-[var(--text-muted)]">Registrar se tomou ajuda sua equipe a cuidar melhor de você. Não substitui a orientação médica.</p>
      <PatientNav />
    </div>
  );
}
