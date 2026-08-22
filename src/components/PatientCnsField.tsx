"use client";

import { useState } from "react";

// Mostra/edita o CNS (Cartão SUS) do paciente. Avisa quando falta — é necessário
// para a LME/CEAF. Nem todo paciente precisa; por isso é opcional e editável aqui.
export function PatientCnsField({ emailParam, cns, onSaved }: { emailParam: string; cns?: string | null; onSaved?: () => void | Promise<void> }) {
  const has = Boolean(cns && String(cns).trim());
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cns || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true); setMsg("");
    const res = await fetch(`/api/doctor/patients/${encodeURIComponent(emailParam)}/demographics`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cns: value }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d.error || "Não foi possível salvar."); return; }
    setEditing(false);
    await onSaved?.();
  }

  if (has && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm">
        <span className="font-semibold text-[var(--text)]">CNS (Cartão SUS):</span>
        <span className="text-[var(--text-soft)]">{cns}</span>
        <button type="button" className="text-xs font-semibold text-[var(--gold)]" onClick={() => { setValue(cns || ""); setEditing(true); }}>editar</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--warn)]/40 bg-[#fff7e8] p-3">
      {!editing && <p className="text-sm font-semibold text-[#7a5a12]">⚠️ Sem CNS cadastrado</p>}
      <p className="mt-0.5 text-xs text-[#7a5a12]">O CNS (Cartão Nacional de Saúde) é necessário para a LME/CEAF. Se este paciente precisar, cadastre agora — senão, pode deixar em branco.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input className="input-field max-w-xs" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="000 0000 0000 0000" />
        <button type="button" className="btn-gold text-sm" disabled={busy || !value.trim()} onClick={save}>Salvar CNS</button>
        {editing && <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(false)}>Cancelar</button>}
      </div>
      {msg && <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{msg}</p>}
    </div>
  );
}
