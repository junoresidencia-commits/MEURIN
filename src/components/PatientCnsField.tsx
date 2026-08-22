"use client";

import { useState } from "react";

// Campo rápido de dados usados na LME (CNS, Nome da mãe). Mostra o valor quando existe
// (com "editar") e AVISA quando falta — pois é necessário para a LME/CEAF. É opcional:
// quem não precisar pode deixar em branco.
type FieldKey = "cns" | "motherName";

export function PatientLmeField({
  emailParam,
  field,
  label,
  value,
  placeholder,
  note,
  numeric = false,
  onSaved,
}: {
  emailParam: string;
  field: FieldKey;
  label: string;
  value?: string | null;
  placeholder?: string;
  note?: string;
  numeric?: boolean;
  onSaved?: () => void | Promise<void>;
}) {
  const has = Boolean(value && String(value).trim());
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true); setMsg("");
    const res = await fetch(`/api/doctor/patients/${encodeURIComponent(emailParam)}/demographics`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: val }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d.error || "Não foi possível salvar."); return; }
    setEditing(false);
    await onSaved?.();
  }

  if (has && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm">
        <span className="font-semibold text-[var(--text)]">{label}:</span>
        <span className="text-[var(--text-soft)]">{value}</span>
        <button type="button" className="text-xs font-semibold text-[var(--gold)]" onClick={() => { setVal(value || ""); setEditing(true); }}>editar</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--warn)]/40 bg-[#fff7e8] p-3">
      {!editing && <p className="text-sm font-semibold text-[#7a5a12]">⚠️ Sem {label.toLowerCase()} cadastrado</p>}
      {note && <p className="mt-0.5 text-xs text-[#7a5a12]">{note}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input className="input-field max-w-xs" inputMode={numeric ? "numeric" : "text"} value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder} />
        <button type="button" className="btn-gold text-sm" disabled={busy || !val.trim()} onClick={save}>Salvar</button>
        {editing && <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(false)}>Cancelar</button>}
      </div>
      {msg && <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{msg}</p>}
    </div>
  );
}
