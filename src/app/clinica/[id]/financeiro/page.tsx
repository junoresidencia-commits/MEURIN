"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Member = { actorId: string; actorKind: string; role: string; name: string };
type Rule = { doctorId: string; feeCents: number; clinicSharePercent: number };
type Row = { id: string; doctorName: string; patientName: string | null; feeCents: number; receivedCents: number; paymentStatus: string; attendedAt: string };
type Summary = { count: number; producedCents: number; receivedCents: number; pendingCents: number; byDoctor: { doctorId: string; doctorName: string; count: number; producedCents: number; receivedCents: number }[] };

export default function ClinicaFinanceiroPage() {
  const params = useParams<{ id: string }>();
  const [doctors, setDoctors] = useState<Member[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [fee, setFee] = useState("450");
  const [share, setShare] = useState("0");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  function loadTeam() {
    fetch(`/api/clinica/${params.id}/invite`)
      .then((r) => r.json())
      .then((d) => {
        const docs = (d.members || []).filter((m: Member) => m.actorKind === "doctor");
        setDoctors(docs);
        if (!doctorId && docs[0]) setDoctorId(docs[0].actorId);
      })
      .catch(() => {});
    fetch(`/api/clinica/${params.id}/fee-rules`)
      .then((r) => r.json())
      .then((d) => setRules(d.rules || []))
      .catch(() => {});
  }
  function loadProd() {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (filterDoctor) q.set("doctorId", filterDoctor);
    fetch(`/api/clinica/${params.id}/producao?${q}`)
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary || null);
        setRows(d.encounters || []);
      })
      .catch(() => {});
  }
  useEffect(() => { loadTeam(); }, [params.id]);
  useEffect(() => { loadProd(); }, [params.id, from, to, filterDoctor]);

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`/api/clinica/${params.id}/fee-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorId,
        feeCents: Math.round(Number(fee) * 100),
        clinicSharePercent: Number(share),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || "Erro"); return; }
    setMsg("Regra salva neste vínculo médico↔clínica.");
    loadTeam();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Produção da clínica</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Atendido (produção) não é recebido. Ex.: consulta de {brl(45000)} pode estar com {brl(0)} recebido até o check-in.
      </p>

      <form onSubmit={saveRule} className="panel mt-5 grid gap-3 sm:grid-cols-4">
        <select className="input-field" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
          <option value="">Médico</option>
          {doctors.map((d) => <option key={d.actorId} value={d.actorId}>{d.name}</option>)}
        </select>
        <input className="input-field" type="number" min="0" step="0.01" placeholder="Valor (R$)" value={fee} onChange={(e) => setFee(e.target.value)} />
        <input className="input-field" type="number" min="0" max="100" step="0.1" placeholder="% clínica" value={share} onChange={(e) => setShare(e.target.value)} />
        <button type="submit" className="btn-gold">Salvar regra</button>
        {msg && <p className="sm:col-span-4 text-sm text-[var(--gold)]">{msg}</p>}
      </form>
      {rules.length > 0 && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Regras ativas: {rules.map((r) => `${doctors.find((d) => d.actorId === r.doctorId)?.name || r.doctorId} ${brl(r.feeCents)}`).join(" · ")}
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <label>
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">De</span>
          <input className="input-field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Até</span>
          <input className="input-field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Médico</span>
          <select className="input-field" value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)}>
            <option value="">Todos</option>
            {doctors.map((d) => <option key={d.actorId} value={d.actorId}>{d.name}</option>)}
          </select>
        </label>
      </div>

      {summary && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Atendidos</p><p className="font-display text-2xl font-extrabold">{summary.count}</p></div>
          <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Produção</p><p className="font-display text-2xl font-extrabold">{brl(summary.producedCents)}</p></div>
          <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Recebido</p><p className="font-display text-2xl font-extrabold">{brl(summary.receivedCents)}</p></div>
        </div>
      )}

      {summary?.byDoctor.map((d) => (
        <div key={d.doctorId} className="panel mt-3">
          <p className="font-bold">{d.doctorName}</p>
          <p className="text-sm text-[var(--text-muted)]">{d.count} atendimentos · produção {brl(d.producedCents)} · recebido {brl(d.receivedCents)}</p>
        </div>
      ))}

      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="panel flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="font-bold">{r.patientName || r.id.slice(0, 8)}</p>
              <p className="text-xs text-[var(--text-muted)]">{r.doctorName} · {new Date(r.attendedAt).toLocaleString("pt-BR")}</p>
            </div>
            <p className="text-sm font-semibold">
              {brl(r.feeCents)} atendido · {brl(r.receivedCents)} recebido · {r.paymentStatus}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
