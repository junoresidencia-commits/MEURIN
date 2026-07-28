"use client";

import { useState } from "react";
import Link from "next/link";
import { formatSlotLabel } from "@/lib/scheduling-client";

type Row = {
  id: string;
  status: string;
  slotStart: string;
  doctorName: string;
  meetingRoomId: string;
  patientName: string;
  patientCity?: string;
};

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
                {b.status === "confirmed" ? "Liberada" : b.status}
              </p>
              {b.status === "confirmed" && (
                <Link href={`/consulta/${b.meetingRoomId}`} className="btn-gold mt-4 inline-flex">
                  Abrir sala
                </Link>
              )}
              <Link
                href={`/confirmacao/${b.id}`}
                className="ml-2 text-sm text-[var(--gold-light)] underline-offset-2 hover:underline"
              >
                Ver confirmação
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
