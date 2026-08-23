"use client";

import { useState } from "react";

type P = { name?: string; phone?: string | null; email?: string | null; city?: string | null; birthdate?: string | null; sex?: string | null };

// Edita os dados básicos do paciente (nome, telefone, e-mail, cidade, nascimento, sexo).
// CPF não é editável aqui por segurança (é a chave de login do paciente).
export function PatientEditForm({ emailParam, patient, onClose, onSaved }: { emailParam: string; patient: P; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [form, setForm] = useState({
    name: patient.name || "",
    phone: patient.phone || "",
    email: patient.email || "",
    address: patient.city || "",
    birthdate: patient.birthdate || "",
    sex: patient.sex || "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (form.name.trim().length < 2) { setMsg("Informe o nome."); return; }
    setBusy(true); setMsg("");
    const res = await fetch(`/api/doctor/patients/${encodeURIComponent(emailParam)}/demographics`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d.error || "Não foi possível salvar."); return; }
    await onSaved();
    onClose();
  }

  return (
    <div className="panel mt-3 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Editar dados do paciente</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome completo</span>
          <input className="input-field" value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Telefone</span>
          <input className="input-field" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">E-mail</span>
          <input className="input-field" inputMode="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Cidade / região</span>
          <input className="input-field" value={form.address} onChange={(e) => set("address", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data de nascimento</span>
          <input type="date" className="input-field" value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Sexo</span>
          <select className="input-field" value={form.sex} onChange={(e) => set("sex", e.target.value)}>
            <option value="">Selecione</option>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
          </select></label>
      </div>
      {msg && <p className="text-sm text-[var(--danger)]">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-gold" disabled={busy} onClick={save}>{busy ? "Salvando…" : "Salvar dados"}</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">CNS e nome da mãe são editados na aba LME/CEAF. O CPF (login do paciente) não é alterado aqui.</p>
    </div>
  );
}
