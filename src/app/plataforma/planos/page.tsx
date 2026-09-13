"use client";

import { useEffect, useState } from "react";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Plan = { id: string; name: string; monthlyCents: number; doctorSeats: number; active: boolean };
type License = {
  id: string;
  status: string;
  monthlyCents: number;
  planName: string;
  clinicName: string | null;
  doctorName: string | null;
  doctorEmail: string | null;
  clinicId: string | null;
  periodEnd: string | null;
};
type Opt = { id: string; name: string; email?: string };

export default function PlanosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [clinics, setClinics] = useState<Opt[]>([]);
  const [doctors, setDoctors] = useState<Opt[]>([]);
  const [mrr, setMrr] = useState({ mrrCents: 0, arrCents: 0, licensesActive: 0, yearMonth: "" });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [seats, setSeats] = useState("1");
  const [planId, setPlanId] = useState("");
  const [target, setTarget] = useState<"clinic" | "doctor">("clinic");
  const [clinicId, setClinicId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/plataforma/saas")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar.");
        setPlans(d.plans || []);
        setLicenses(d.licenses || []);
        setClinics(d.clinics || []);
        setDoctors(d.doctors || []);
        setMrr(d.mrr || { mrrCents: 0, arrCents: 0, licensesActive: 0, yearMonth: "" });
        if (!planId && d.plans?.[0]) setPlanId(d.plans[0].id);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }
  useEffect(() => { load(); }, []);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/plataforma/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, monthlyReais: Number(price), doctorSeats: Number(seats) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível criar.");
      setName("");
      setPrice("");
      setMsg("Plano criado. Não altera pacientes nem o caixa da clínica.");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/plataforma/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          status,
          clinicId: target === "clinic" ? clinicId : undefined,
          doctorId: target === "doctor" ? doctorId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível licenciar.");
      setMsg("Licença registrada. Login e prontuário continuam iguais.");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string) {
    setErr("");
    const res = await fetch(`/api/plataforma/licenses/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || "Não foi possível cancelar."); return; }
    setMsg("Licença cancelada. A área médica permanece liberada.");
    load();
  }

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--gold)]">SaaS Meu Rim</p>
      <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Planos e licenças</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-soft)]">
        Assinatura da plataforma — separado do financeiro da clínica (produção, check-in e repasse).
        Sem licença o médico continua com agenda, pacientes e prontuário.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="panel">
          <p className="text-xs uppercase text-[var(--text-muted)]">MRR</p>
          <p className="font-display text-2xl font-extrabold">{brl(mrr.mrrCents)}</p>
          <p className="text-xs text-[var(--text-muted)]">{mrr.yearMonth || "mês atual"}</p>
        </div>
        <div className="panel">
          <p className="text-xs uppercase text-[var(--text-muted)]">ARR</p>
          <p className="font-display text-2xl font-extrabold">{brl(mrr.arrCents)}</p>
        </div>
        <div className="panel">
          <p className="text-xs uppercase text-[var(--text-muted)]">Licenças ativas</p>
          <p className="font-display text-2xl font-extrabold">{mrr.licensesActive}</p>
        </div>
      </div>

      <form onSubmit={createPlan} className="panel mt-6 grid gap-3 sm:grid-cols-4">
        <p className="sm:col-span-4 font-bold">Novo plano</p>
        <input className="input-field" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input-field" type="number" min="0" step="0.01" placeholder="Mensal (R$)" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <input className="input-field" type="number" min="1" placeholder="Assentos médicos" value={seats} onChange={(e) => setSeats(e.target.value)} required />
        <button type="submit" className="btn-gold" disabled={saving}>{saving ? "Salvando…" : "Criar plano"}</button>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className="panel">
            <p className="font-bold">{p.name}</p>
            <p className="font-display text-xl font-extrabold">{brl(p.monthlyCents)}<span className="text-sm font-semibold text-[var(--text-muted)]">/mês</span></p>
            <p className="text-sm text-[var(--text-muted)]">{p.doctorSeats} médico{p.doctorSeats === 1 ? "" : "s"}</p>
          </div>
        ))}
      </div>

      <form onSubmit={assign} className="panel mt-6 grid gap-3 sm:grid-cols-2">
        <p className="sm:col-span-2 font-bold">Conceder licença</p>
        <select className="input-field" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
          <option value="">Plano</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {brl(p.monthlyCents)}</option>)}
        </select>
        <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Ativa</option>
          <option value="trial">Trial</option>
        </select>
        <select className="input-field" value={target} onChange={(e) => setTarget(e.target.value as "clinic" | "doctor")}>
          <option value="clinic">Clínica</option>
          <option value="doctor">Médico solo (sem clínica)</option>
        </select>
        {target === "clinic" ? (
          <select className="input-field" value={clinicId} onChange={(e) => setClinicId(e.target.value)} required>
            <option value="">Escolher clínica</option>
            {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <select className="input-field" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
            <option value="">Escolher médico</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.email}</option>)}
          </select>
        )}
        <button type="submit" className="btn-gold sm:col-span-2" disabled={saving}>Registrar licença</button>
      </form>

      {msg && <p className="mt-3 text-sm text-[var(--gold)]">{msg}</p>}
      {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}

      <h2 className="mt-8 font-display text-xl font-bold">Licenças</h2>
      <div className="mt-2 space-y-2">
        {licenses.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma licença. Clínicas e médicos atuais funcionam sem ela.</p>}
        {licenses.map((l) => (
          <div key={l.id} className="panel flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold">{l.clinicName || l.doctorName || "—"} · {l.planName}</p>
              <p className="text-sm text-[var(--text-soft)]">
                {l.status} · {brl(l.monthlyCents)}/mês
                {l.periodEnd ? ` · até ${l.periodEnd}` : ""}
                {l.doctorEmail ? ` · ${l.doctorEmail}` : ""}
              </p>
            </div>
            {(l.status === "active" || l.status === "trial") && (
              <button type="button" className="btn-ghost text-sm" onClick={() => cancel(l.id)}>Cancelar</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
