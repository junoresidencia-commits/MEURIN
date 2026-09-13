"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Clinic = { id: string; name: string; city: string | null; status: string; createdAt: string };

export default function ClinicasPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [gestoraEmail, setGestoraEmail] = useState<Record<string, string>>({});
  const [gestoraMsg, setGestoraMsg] = useState<Record<string, string>>({});

  function load() {
    fetch("/api/plataforma/clinics")
      .then((r) => r.json())
      .then((d) => setClinics(d.clinics || []))
      .catch(() => setClinics([]));
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/plataforma/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, city }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível criar.");
      setName("");
      setCity("");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function assignGestora(clinicId: string) {
    const email = (gestoraEmail[clinicId] || "").trim();
    const res = await fetch(`/api/plataforma/clinics/${clinicId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: "ADMIN_CLINICA" }),
    });
    const data = await res.json();
    setGestoraMsg((m) => ({
      ...m,
      [clinicId]: res.ok
        ? `Gestora nomeada no médico já existente (${data.doctorId}).`
        : (data.error || "Não foi possível nomear."),
    }));
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Clínicas</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Cadastro vazio no início. Pacientes atuais <b>não</b> são migrados automaticamente.
      </p>
      <form onSubmit={create} className="panel mt-5 grid gap-3 sm:grid-cols-3">
        <input className="input-field" placeholder="Nome (ex.: Medclin)" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input-field" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
        <button type="submit" className="btn-gold" disabled={saving}>{saving ? "Salvando…" : "Criar clínica"}</button>
        {err && <p className="sm:col-span-3 text-sm text-[var(--danger)]">{err}</p>}
      </form>
      <div className="mt-4 space-y-2">
        {clinics.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma clínica ainda.</p>}
        {clinics.map((c) => (
          <div key={c.id} className="panel space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">{c.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{[c.city, c.status].filter(Boolean).join(" · ")}</p>
              </div>
              <Link href={`/clinica/${c.id}`} className="btn-gold text-sm">Abrir gestão</Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="input-field"
                type="email"
                placeholder="E-mail da gestora (médico já cadastrado)"
                value={gestoraEmail[c.id] || ""}
                onChange={(e) => setGestoraEmail((m) => ({ ...m, [c.id]: e.target.value }))}
              />
              <button type="button" className="btn-ghost" onClick={() => assignGestora(c.id)}>Nomear gestora</button>
            </div>
            {gestoraMsg[c.id] && <p className="text-xs text-[var(--text-muted)]">{gestoraMsg[c.id]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
