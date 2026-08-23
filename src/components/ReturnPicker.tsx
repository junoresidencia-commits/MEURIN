"use client";

import { useState } from "react";

const OPTIONS: { id: string; label: string }[] = [
  { id: "15d", label: "15 dias" },
  { id: "30d", label: "30 dias" },
  { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" },
  { id: "1a", label: "1 ano" },
];

// Define o próximo retorno ao FINAL da consulta (contado a partir de hoje).
export function ReturnPicker({ patientKey }: { patientKey: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [showDate, setShowDate] = useState(false);

  async function set(interval: string, dueDate?: string) {
    setBusy(true); setMsg("");
    const res = await fetch(`/api/doctor/patients/${encodeURIComponent(patientKey)}/return`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval, dueDate }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d.error || "Não foi possível salvar o retorno."); return; }
    const d = await res.json();
    const due = d.return?.dueAt ? new Date(d.return.dueAt).toLocaleDateString("pt-BR") : "";
    setMsg(`Retorno salvo — previsão: ${due}. O sistema vai alertar quando chegar a data.`);
    setShowDate(false);
  }

  return (
    <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)]/50 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Próximo retorno</p>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">Contado a partir de hoje (data do atendimento). Aparece na Central de retornos e alerta quando chegar a data.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button key={o.id} type="button" disabled={busy} onClick={() => set(o.id)}
            className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-soft)] transition hover:border-[var(--gold)] hover:text-[var(--gold)]">
            {o.label}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={() => setShowDate((v) => !v)}
          className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-soft)] transition hover:border-[var(--gold)] hover:text-[var(--gold)]">
          Escolher data
        </button>
      </div>
      {showDate && (
        <div className="mt-2 flex items-center gap-2">
          <input type="date" className="input-field" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
          <button type="button" className="btn-gold text-sm" disabled={busy || !customDate} onClick={() => set("data", customDate)}>Salvar data</button>
        </div>
      )}
      {msg && <p className="mt-2 text-xs font-semibold text-[var(--green)]">{msg}</p>}
    </div>
  );
}
