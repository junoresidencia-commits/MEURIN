"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Closing = {
  id: string;
  code: string;
  doctorName: string;
  periodFrom: string;
  periodTo: string;
  producedCents: number;
  receivedCents: number;
  clinicShareCents: number;
  doctorShareCents: number;
  netCents: number;
  status: string;
  paidAt: string | null;
};
type Adj = { id: string; kind: string; amountCents: number; reason: string; createdAt: string; createdByEmail: string | null };
type Enc = { id: string; patientName: string | null; feeCents: number; receivedCents: number; attendedAt: string };

export default function FechamentoDetalhePage() {
  const params = useParams<{ id: string; closingId: string }>();
  const [closing, setClosing] = useState<Closing | null>(null);
  const [adjustments, setAdjustments] = useState<Adj[]>([]);
  const [encounters, setEncounters] = useState<Enc[]>([]);
  const [kind, setKind] = useState("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  function load() {
    fetch(`/api/clinica/${params.id}/fechamentos/${params.closingId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível abrir o fechamento.");
        setClosing(d.closing || null);
        setAdjustments(d.adjustments || []);
        setEncounters(d.encounters || []);
      })
      .catch((e) => {
        setClosing(null);
        setErr(e instanceof Error ? e.message : "Erro");
      })
      .finally(() => setLoaded(true));
  }
  useEffect(() => { load(); }, [params.id, params.closingId]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setMsg("");
    setErr("");
    const res = await fetch(`/api/clinica/${params.id}/fechamentos/${params.closingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || "Erro"); return; }
    setMsg(action === "pay" ? "Repasse marcado como pago." : "Ajuste auditado registrado.");
    setReason("");
    setAmount("");
    load();
  }

  if (!loaded) return <p className="text-[var(--text-muted)]">Carregando fechamento…</p>;
  if (!closing) {
    return (
      <div>
        <Link href={`/clinica/${params.id}/fechamentos`} className="text-sm font-semibold text-[var(--gold)]">← Fechamentos</Link>
        <p className="mt-4 text-sm text-[var(--danger)]">{err || "Fechamento não encontrado."}</p>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/clinica/${params.id}/fechamentos`} className="text-sm font-semibold text-[var(--gold)]">← Fechamentos</Link>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">{closing.code}</h1>
      <p className="text-sm text-[var(--text-muted)]">{closing.doctorName} · {closing.periodFrom} a {closing.periodTo}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Produção</p><p className="font-display text-2xl font-extrabold">{brl(closing.producedCents)}</p></div>
        <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Recebido</p><p className="font-display text-2xl font-extrabold">{brl(closing.receivedCents)}</p></div>
        <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Clínica</p><p className="font-display text-2xl font-extrabold">{brl(closing.clinicShareCents)}</p></div>
        <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Líquido ao médico</p><p className="font-display text-2xl font-extrabold">{brl(closing.netCents)}</p></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a className="btn-gold" href={`/api/clinica/${params.id}/fechamentos/${params.closingId}/pdf`}>Baixar PDF</a>
        {closing.status === "paid" ? (
          <a className="btn-ghost" href={`/api/clinica/${params.id}/fechamentos/${params.closingId}/comprovante`}>Comprovante de repasse</a>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => act("pay")}>Marcar repasse pago</button>
        )}
      </div>
      {closing.paidAt && <p className="mt-2 text-xs text-[var(--text-muted)]">Pago em {new Date(closing.paidAt).toLocaleString("pt-BR")}</p>}

      {closing.status === "paid" && (
        <form
          className="panel mt-6 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            act("adjust", { kind, amountCents: Math.round(Number(amount) * 100), reason });
          }}
        >
          <p className="font-bold">Ajuste auditado (após pago)</p>
          <p className="text-sm text-[var(--text-muted)]">Não apaga o fechamento. Motivo obrigatório.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="input-field" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="credit">Crédito ao médico</option>
              <option value="debit">Débito do médico</option>
              <option value="correction">Correção</option>
            </select>
            <input className="input-field" type="number" min="0.01" step="0.01" placeholder="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <input className="input-field" placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} />
          </div>
          <button type="submit" className="btn-gold">Registrar ajuste</button>
        </form>
      )}

      {msg && <p className="mt-3 text-sm text-[var(--gold)]">{msg}</p>}
      {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}

      {adjustments.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-xl font-bold">Ajustes</h2>
          {adjustments.map((a) => (
            <div key={a.id} className="panel mt-2">
              <p className="font-bold">{a.kind} · {brl(a.amountCents)}</p>
              <p className="text-sm text-[var(--text-soft)]">{a.reason}</p>
              <p className="text-xs text-[var(--text-muted)]">{new Date(a.createdAt).toLocaleString("pt-BR")} · {a.createdByEmail}</p>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-8 font-display text-xl font-bold">Atendimentos</h2>
      <div className="mt-2 space-y-2">
        {encounters.map((e) => (
          <div key={e.id} className="panel flex flex-wrap justify-between gap-2">
            <p className="font-bold">{e.patientName || e.id.slice(0, 8)}</p>
            <p className="text-sm">{brl(e.feeCents)} atendido · {brl(e.receivedCents)} recebido</p>
          </div>
        ))}
      </div>
    </div>
  );
}
