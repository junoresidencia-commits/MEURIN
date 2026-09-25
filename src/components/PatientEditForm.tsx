"use client";

import { useMemo, useState } from "react";
import { ageFromBirthdate } from "@/lib/patient-age";

type P = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  birthdate?: string | null;
  ageYears?: number | null;
  ageReportedAt?: string | null;
  sex?: string | null;
};

export function PatientEditForm({ emailParam, patient, onClose, onSaved }: { emailParam: string; patient: P; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [form, setForm] = useState({
    name: patient.name || "",
    phone: patient.phone || "",
    email: patient.email || "",
    address: patient.city || "",
    birthdate: patient.birthdate ? String(patient.birthdate).slice(0, 10) : "",
    ageYears: patient.ageYears != null ? String(patient.ageYears) : "",
    ageReportedAt: patient.ageReportedAt ? String(patient.ageReportedAt).slice(0, 7) : "",
    sex: patient.sex || "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  const calculated = useMemo(() => ageFromBirthdate(form.birthdate || null), [form.birthdate]);

  async function save() {
    if (form.name.trim().length < 2) { setMsg("Informe o nome."); return; }
    setBusy(true); setMsg("");
    const body: Record<string, unknown> = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      address: form.address,
      sex: form.sex,
      birthdate: form.birthdate || "",
    };
    if (!form.birthdate) {
      body.ageYears = form.ageYears.trim() === "" ? null : form.ageYears;
      body.ageReportedAt = form.ageReportedAt || "";
    }
    const res = await fetch(`/api/doctor/patients/${encodeURIComponent(emailParam)}/demographics`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
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
        {form.birthdate ? (
          <p className="sm:col-span-2 text-sm text-[var(--text-soft)]">Idade calculada: <b>{calculated != null ? `${calculated} anos` : "data inválida"}</b></p>
        ) : (
          <>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Idade manual (anos)</span>
              <input inputMode="numeric" className="input-field" placeholder="ex.: 64" value={form.ageYears} onChange={(e) => set("ageYears", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data de referência da idade</span>
              <input type="month" className="input-field" value={form.ageReportedAt} onChange={(e) => set("ageReportedAt", e.target.value)} /></label>
            <p className="sm:col-span-2 text-xs text-[var(--text-muted)]">Use a data de nascimento quando souber. Sem ela, a idade manual fica registrada com o mês/ano (ex.: 64 anos em 09/2026). Não é obrigatório preencher os dois.</p>
          </>
        )}
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
