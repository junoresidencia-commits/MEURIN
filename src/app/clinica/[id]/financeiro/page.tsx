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
type Issue = { tone: "red" | "yellow"; text: string };
type EventRow = {
  id: string;
  kind: string;
  beforeCents: number | null;
  afterCents: number | null;
  reason: string | null;
  actorEmail: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  fee_rule: "Regra de honorário",
  checkin: "Check-in",
  closing: "Fechamento",
  payout: "Repasse pago",
  adjustment: "Ajuste",
};

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
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

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
    fetch(`/api/clinica/${params.id}/resumo`)
      .then((r) => r.json())
      .then((d) => setIssues(d.resumo?.inconsistencies || []))
      .catch(() => {});
    fetch(`/api/clinica/${params.id}/financeiro-eventos`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
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
  useEffect(() => {
    function refresh() {
      loadTeam();
      loadProd();
    }
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [params.id, from, to, filterDoctor]);

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const feeCents = Math.round(Number(fee) * 100);
    const previous = rules.find((r) => r.doctorId === doctorId);
    if (previous && previous.feeCents !== feeCents) {
      const ok = window.confirm(
        `Alterar ${brl(previous.feeCents)} → ${brl(feeCents)}? A mudança fica registrada com o motivo.`
      );
      if (!ok) return;
    } else if (!previous && (feeCents >= 90000 || (feeCents > 0 && feeCents <= 5000))) {
      const ok = window.confirm(`Esse valor está muito diferente do habitual (R$ 450). Deseja confirmar ${brl(feeCents)}?`);
      if (!ok) return;
    }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/clinica/${params.id}/fee-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId,
          feeCents,
          clinicSharePercent: Number(share),
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Não foi possível salvar a regra agora."); return; }
      setMsg("Regra salva neste vínculo médico↔clínica. A alteração ficou no histórico.");
      setReason("");
      loadTeam();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Produção da clínica</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        O valor e o % são deste vínculo (ex.: Salute R$ 450 e 30%; outra cidade R$ 550 e 20%). Atendido não é recebido até o check-in.
      </p>

      <form onSubmit={saveRule} className="panel mt-5 grid gap-3 sm:grid-cols-4">
        <select className="input-field min-h-12" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
          <option value="">Médico</option>
          {doctors.map((d) => <option key={d.actorId} value={d.actorId}>{d.name}</option>)}
        </select>
        <input className="input-field min-h-12" type="number" min="0" step="0.01" placeholder="Valor nesta clínica (R$)" value={fee} onChange={(e) => setFee(e.target.value)} />
        <input className="input-field min-h-12" type="number" min="0" max="100" step="0.1" placeholder="% desta clínica" value={share} onChange={(e) => setShare(e.target.value)} />
        <input className="input-field min-h-12 sm:col-span-3" placeholder="Motivo se alterar valor (obrigatório na mudança)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button type="submit" className="btn-gold min-h-12" disabled={saving}>{saving ? "Salvando…" : "Salvar regra"}</button>
        {msg && <p className="sm:col-span-4 text-sm text-[var(--gold)]">{msg}</p>}
      </form>
      {rules.length > 0 && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Regras ativas: {rules.map((r) => `${doctors.find((d) => d.actorId === r.doctorId)?.name || r.doctorId} ${brl(r.feeCents)}`).join(" · ")}
        </p>
      )}

      {issues.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Inconsistências</p>
          {issues.map((i) => (
            <div
              key={i.text}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                i.tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {i.text}
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Histórico financeiro</p>
          <div className="mt-2 space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="panel">
                <p className="text-sm font-bold">{KIND_LABEL[ev.kind] || ev.kind}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {new Date(ev.createdAt).toLocaleString("pt-BR")}
                  {ev.actorEmail ? ` · ${ev.actorEmail}` : ""}
                </p>
                <p className="mt-1 text-sm">
                  {ev.beforeCents != null ? `${brl(ev.beforeCents)} → ` : ""}
                  {ev.afterCents != null ? brl(ev.afterCents) : "—"}
                  {ev.reason ? ` · ${ev.reason}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
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
