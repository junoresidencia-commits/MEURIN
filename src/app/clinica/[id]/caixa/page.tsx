"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Encounter = {
  id: string;
  patientName: string | null;
  feeCents: number;
  receivedCents: number;
  paymentStatus: string;
  attendedAt: string;
};

export default function ClinicaCaixaPage() {
  const params = useParams<{ id: string }>();
  const [rows, setRows] = useState<Encounter[]>([]);
  const [encounterId, setEncounterId] = useState("");
  const [method, setMethod] = useState("pix");
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch(`/api/clinica/${params.id}/checkin`)
      .then((r) => r.json())
      .then((d) => {
        const list = d.encounters || [];
        setRows(list);
        if (!encounterId && list[0]) {
          setEncounterId(list[0].id);
          setAmount(((list[0].feeCents - list[0].receivedCents) / 100).toFixed(2));
        }
      })
      .catch(() => {});
  }
  useEffect(() => { load(); }, [params.id]);

  useEffect(() => {
    const row = rows.find((r) => r.id === encounterId);
    if (row) setAmount(((row.feeCents - row.receivedCents) / 100).toFixed(2));
  }, [encounterId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const row = rows.find((r) => r.id === encounterId);
    const cents = method === "courtesy" ? 0 : Math.round(Number(amount) * 100);
    if (row && method !== "courtesy" && row.feeCents > 0) {
      const ratio = cents / row.feeCents;
      if (ratio >= 2 || ratio <= 0.5) {
        const ok = window.confirm(
          `Esse valor está muito diferente do habitual (${brl(row.feeCents)}). Deseja confirmar ${brl(cents)}?`
        );
        if (!ok) return;
      }
    }
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/clinica/${params.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId,
          method,
          amountCents: cents,
          discountCents: Math.round(Number(discount) * 100),
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Não foi possível registrar o pagamento agora."); return; }
      setMsg("Check-in registrado. A produção já existia; agora o recebido foi atualizado.");
      setNote("");
      setEncounterId("");
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Check-in financeiro</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Finalizar o atendimento no prontuário gera a produção. Aqui a atendente registra se entrou dinheiro.
      </p>
      <form onSubmit={submit} className="panel mt-5 grid gap-3">
        <select className="input-field min-h-12" value={encounterId} onChange={(e) => setEncounterId(e.target.value)} required>
          <option value="">Atendimento pendente</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {(r.patientName || "Paciente")} · {brl(r.feeCents)} atendido · {brl(r.receivedCents)} recebido
            </option>
          ))}
        </select>
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="input-field min-h-12" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="pix">Pix</option>
            <option value="card">Cartão</option>
            <option value="cash">Dinheiro</option>
            <option value="courtesy">Cortesia</option>
            <option value="other">Outro</option>
          </select>
          <input className="input-field min-h-12" type="number" min="0" step="0.01" placeholder="Valor recebido" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={method === "courtesy"} />
          <input className="input-field min-h-12" type="number" min="0" step="0.01" placeholder="Desconto" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <input className="input-field min-h-12" placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit" className="btn-gold min-h-12" disabled={!encounterId || saving}>
          {saving ? "Registrando…" : "Confirmar pagamento"}
        </button>
        {msg && <p className="text-sm text-[var(--gold)]">{msg}</p>}
        {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
      </form>
      {rows.length === 0 && <p className="mt-4 text-sm text-[var(--text-muted)]">Nenhum atendimento aguardando check-in.</p>}
    </div>
  );
}
