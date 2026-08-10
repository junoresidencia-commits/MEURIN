"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type DoctorLink = { doctorId: string; doctorName: string; permissions: Record<string, boolean> };
type PatientRow = { key: string; name: string; cpf: string; phone: string; email: string; isCreated: boolean };
type Slot = { start: string; end: string; label: string; modality: string; locationId?: string; locationName?: string; priceCents: number };
type Loc = { id: string; name: string; city: string };

export default function AtendenteAgendarPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<DoctorLink[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientRow[]>([]);
  const [patient, setPatient] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newP, setNewP] = useState({ name: "", cpf: "", birthdate: "", phone: "", email: "" });
  const [modality, setModality] = useState<"presencial" | "teleconsulta">("teleconsulta");
  const [locations, setLocations] = useState<Loc[]>([]);
  const [locationId, setLocationId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/atendente/me").then((r) => r.json());
      if (!me.attendant) { router.replace("/atendente/login"); return; }
      setDoctors(me.doctors || []);
      setDoctorId(me.doctors?.[0]?.doctorId || "");
    })();
  }, [router]);

  const search = useCallback(async () => {
    if (!doctorId) return;
    const r = await fetch(`/api/atendente/patients?doctorId=${doctorId}&q=${encodeURIComponent(q)}`).then((x) => x.json());
    setResults(r.patients || []);
  }, [doctorId, q]);

  const loadSlots = useCallback(async () => {
    if (!doctorId) return;
    const qs = new URLSearchParams({ doctorId, modality });
    if (modality === "presencial" && locationId) qs.set("locationId", locationId);
    const r = await fetch(`/api/atendente/availability?${qs.toString()}`).then((x) => x.json());
    setSlots(r.slots || []);
    setLocations(r.locations || []);
  }, [doctorId, modality, locationId]);

  useEffect(() => { if (patient) loadSlots(); }, [patient, loadSlots]);

  async function createPatient() {
    setMsg("");
    if (!newP.name.trim()) { setMsg("Informe o nome."); return; }
    const res = await fetch("/api/atendente/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doctorId, ...newP }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || "Falha ao criar paciente."); return; }
    setPatient({ name: newP.name, email: newP.email, phone: newP.phone });
    setCreating(false);
  }

  async function confirmar(slot: Slot) {
    if (!patient) return;
    setMsg("");
    const res = await fetch("/api/atendente/appointments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId, patientName: patient.name, patientEmail: patient.email, patientPhone: patient.phone, slotStart: slot.start, modality, locationId: modality === "presencial" ? locationId : undefined }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || "Não foi possível agendar."); loadSlots(); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-2xl">✓</div>
        <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">Consulta agendada!</h1>
        <p className="mt-2 text-[var(--text-muted)]">Já aparece na agenda do médico e no aplicativo do paciente.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/atendente/painel" className="btn-gold">Ir para o painel</Link>
          <button className="btn-ghost" onClick={() => { setDone(false); setPatient(null); setResults([]); setQ(""); }}>Agendar outra</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-8">
      <Link href="/atendente/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
      <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">Novo agendamento</h1>

      {doctors.length > 1 && (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Médico</span>
          <select className="input-field" value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setPatient(null); }}>
            {doctors.map((d) => <option key={d.doctorId} value={d.doctorId}>{d.doctorName}</option>)}
          </select>
        </label>
      )}

      {!patient ? (
        <div className="panel mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Paciente</p>
          <div className="mt-2 flex gap-2">
            <input className="input-field" placeholder="Buscar por nome, CPF ou telefone" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
            <button type="button" className="btn-ghost" onClick={search}>Buscar</button>
          </div>
          <div className="mt-2 grid gap-1">
            {results.map((p) => (
              <button key={p.key} type="button" className="rounded-xl border border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--bg-soft)]" onClick={() => setPatient({ name: p.name, email: p.email, phone: p.phone })}>
                <span className="font-semibold text-[var(--text)]">{p.name}</span>
                <span className="ml-2 text-xs text-[var(--text-muted)]">{[p.cpf, p.phone, p.email].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-ghost mt-3 text-sm" onClick={() => setCreating((v) => !v)}>+ Criar paciente</button>
          {creating && (
            <div className="mt-2 grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-2">
              <input className="input-field" placeholder="Nome completo" value={newP.name} onChange={(e) => setNewP({ ...newP, name: e.target.value })} />
              <input className="input-field" placeholder="CPF" value={newP.cpf} onChange={(e) => setNewP({ ...newP, cpf: e.target.value })} />
              <input className="input-field" placeholder="Telefone/WhatsApp" value={newP.phone} onChange={(e) => setNewP({ ...newP, phone: e.target.value })} />
              <input className="input-field" placeholder="E-mail (opcional)" value={newP.email} onChange={(e) => setNewP({ ...newP, email: e.target.value })} />
              <input className="input-field" type="date" value={newP.birthdate} onChange={(e) => setNewP({ ...newP, birthdate: e.target.value })} />
              <div className="flex items-end"><button type="button" className="btn-gold" onClick={createPatient}>Criar e continuar</button></div>
            </div>
          )}
        </div>
      ) : (
        <div className="panel mt-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[var(--text)]">{patient.name}</p>
            <button type="button" className="btn-ghost text-sm" onClick={() => setPatient(null)}>Trocar</button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Modalidade</span>
              <select className="input-field" value={modality} onChange={(e) => setModality(e.target.value as "presencial" | "teleconsulta")}>
                <option value="teleconsulta">Teleconsulta</option>
                <option value="presencial">Presencial</option>
              </select>
            </label>
            {modality === "presencial" && (
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Clínica</span>
                <select className="input-field" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">Selecione</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.city}</option>)}
                </select>
              </label>
            )}
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Horários disponíveis</p>
          <div className="mt-2 flex max-h-72 flex-wrap gap-2 overflow-y-auto">
            {slots.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum horário para os filtros atuais.</p>}
            {slots.slice(0, 60).map((s) => (
              <button key={s.start} type="button" className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--gold-soft)]" onClick={() => confirmar(s)}>{s.label}</button>
            ))}
          </div>
        </div>
      )}
      {msg && <p className="mt-3 text-sm font-semibold text-[var(--danger)]">{msg}</p>}
    </div>
  );
}
