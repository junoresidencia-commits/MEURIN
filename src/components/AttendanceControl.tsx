"use client";

import { useEffect, useState } from "react";

const INTERVALS: { id: string; label: string }[] = [
  { id: "15d", label: "15 dias" },
  { id: "30d", label: "30 dias" },
  { id: "60d", label: "60 dias" },
  { id: "90d", label: "90 dias" },
  { id: "6m", label: "6 meses" },
  { id: "1a", label: "1 ano" },
  { id: "data", label: "Escolher data" },
  { id: "sem", label: "Sem retorno" },
];

function fmt(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

export function AttendanceControl({ patientKey, bookingId, compact = false }: { patientKey: string; bookingId?: string | null; compact?: boolean }) {
  const [open, setOpen] = useState<boolean | null>(null); // null = carregando
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let live = true;
    fetch(`/api/doctor/patients/${encodeURIComponent(patientKey)}/attendance`)
      .then((r) => (r.ok ? r.json() : { open: null }))
      .then((d) => { if (live) { setOpen(Boolean(d.open)); setStartedAt(d.open?.startedAt || null); } })
      .catch(() => { if (live) setOpen(false); });
    return () => { live = false; };
  }, [patientKey]);

  async function start() {
    setBusy(true); setMsg("");
    const res = await fetch(`/api/doctor/patients/${encodeURIComponent(patientKey)}/attendance`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", bookingId: bookingId || null }),
    });
    setBusy(false);
    if (res.ok) { const d = await res.json(); setOpen(true); setStartedAt(d.attendance?.startedAt || new Date().toISOString()); }
    else setMsg("Não foi possível iniciar.");
  }

  async function finish(interval: string) {
    if (interval === "data" && !customDate) { setMsg("Escolha a data do retorno."); return; }
    setBusy(true); setMsg("");
    const res = await fetch(`/api/doctor/patients/${encodeURIComponent(patientKey)}/attendance`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finish", bookingId: bookingId || null, returnInterval: interval, returnDate: interval === "data" ? customDate : undefined }),
    });
    setBusy(false);
    if (!res.ok) { setMsg("Não foi possível finalizar."); return; }
    const d = await res.json();
    setOpen(false); setStartedAt(null); setFinishOpen(false);
    setMsg(d.return?.dueAt ? `Atendimento finalizado. Retorno previsto: ${fmt(d.return.dueAt)}.` : "Atendimento finalizado.");
  }

  if (open === null) return null;

  return (
    <div className={compact ? "" : "flex flex-col gap-1"}>
      <div className="flex flex-wrap items-center gap-2">
        {!open ? (
          <button type="button" className="btn-gold text-sm" disabled={busy} onClick={start}>Iniciar atendimento</button>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-soft)] px-3 py-1 text-xs font-semibold text-[var(--gold)]">● Em andamento{startedAt ? ` · desde ${new Date(startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
            <button type="button" className="btn-gold text-sm" disabled={busy} onClick={() => setFinishOpen(true)}>Finalizar atendimento</button>
          </>
        )}
      </div>
      {msg && <p className="text-xs font-semibold text-[var(--green)]">{msg}</p>}

      {finishOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setFinishOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <h3 className="font-display text-xl text-[var(--text)]">Finalizar atendimento</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Defina o próximo retorno (opcional).</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {INTERVALS.filter((i) => i.id !== "data" && i.id !== "sem").map((i) => (
                <button key={i.id} type="button" className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-soft)] transition hover:border-[var(--gold)] hover:text-[var(--gold)]" disabled={busy} onClick={() => finish(i.id)}>{i.label}</button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input type="date" className="input-field" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
              <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => finish("data")}>Usar data</button>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button type="button" className="text-sm font-semibold text-[var(--text-muted)]" disabled={busy} onClick={() => finish("sem")}>Sem retorno definido</button>
              <button type="button" className="btn-ghost text-sm" onClick={() => setFinishOpen(false)}>Cancelar</button>
            </div>
            {msg && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
