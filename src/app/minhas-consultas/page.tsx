"use client";

import { useState } from "react";
import Link from "next/link";
import { formatSlotLabel } from "@/lib/scheduling-client";

type Row = {
  id: string;
  status: string;
  stage?: string | null;
  slotStart: string;
  doctorName: string;
  doctorWhatsapp?: string | null;
  meetingRoomId: string;
  patientName: string;
  patientCity?: string;
  proposedSlotStart?: string | null;
  proposalMessage?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Aguardando confirmação do médico",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
};
function labelFor(b: Row): string {
  if (b.stage === "proposto_novo_horario") return "Médico propôs um novo horário";
  if (b.stage === "nao_realizada") return "Não realizada";
  if (b.stage === "remarcada") return "Remarcada";
  return STATUS_LABEL[b.status] || b.status;
}

export default function MinhasConsultasPage() {
  const [email, setEmail] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRows(null);
    try {
      const res = await fetch(`/api/bookings/lookup?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setRows(data.bookings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function respondProposal(id: string, action: "accept" | "decline") {
    const res = await fetch(`/api/bookings/${id}/proposal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      window.alert(d.error || "Não foi possível responder agora.");
      return;
    }
    // Recarrega a lista para refletir o novo status.
    const r = await fetch(`/api/bookings/lookup?email=${encodeURIComponent(email)}`);
    const data = await r.json();
    setRows(data.bookings || []);
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
        Paciente
      </p>
      <h1 className="font-display mt-2 text-4xl text-[var(--text)]">Minhas consultas</h1>
      <p className="mt-3 text-[var(--text-muted)]">
        Digite o e-mail usado no agendamento para achar o link da sala.
      </p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
            E-mail
          </span>
          <input
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button type="submit" className="btn-gold w-full" disabled={loading}>
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {rows && (
        <div className="mt-8 space-y-3">
          {rows.length === 0 && (
            <p className="text-[var(--text-muted)]">Nenhuma consulta neste e-mail.</p>
          )}
          {rows.map((b) => (
            <div key={b.id} className="panel">
              <p className="font-semibold text-[var(--text)]">{b.doctorName}</p>
              <p className="text-sm text-[var(--text-muted)]">{formatSlotLabel(b.slotStart)}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-[var(--gold-light)]">
                {labelFor(b)}
              </p>

              {b.stage === "proposto_novo_horario" && b.proposedSlotStart && (
                <div className="mt-3 rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-3">
                  <p className="text-sm text-[var(--text)]">
                    {b.doctorName} propôs um novo horário: <strong>{fmt(b.proposedSlotStart)}</strong>
                  </p>
                  {b.proposalMessage && <p className="mt-1 text-sm text-[var(--text-soft)]">“{b.proposalMessage}”</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn-gold" onClick={() => respondProposal(b.id, "accept")}>Aceitar novo horário</button>
                    <button type="button" className="btn-ghost" onClick={() => respondProposal(b.id, "decline")}>Não posso neste horário</button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {b.status === "confirmed" && (
                  <Link href={`/consulta/${b.meetingRoomId}`} className="btn-gold inline-flex">
                    Abrir sala
                  </Link>
                )}
                {b.doctorWhatsapp && (
                  <a
                    href={`https://wa.me/${(b.doctorWhatsapp || "").replace(/\D/g, "").replace(/^(?!55)/, "55")}?text=${encodeURIComponent(`Olá! Sou ${b.patientName}. Estou entrando em contato sobre minha consulta com ${b.doctorName}, marcada para ${fmt(b.slotStart)}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost"
                  >
                    Falar sobre esta consulta
                  </a>
                )}
                <Link
                  href={`/confirmacao/${b.id}`}
                  className="text-sm text-[var(--gold-light)] underline-offset-2 hover:underline"
                >
                  Ver detalhes
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
