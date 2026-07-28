"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatBRL, formatSlotLabel } from "@/lib/scheduling-client";
import type { Booking } from "@/lib/types";

export default function ConfirmacaoPage() {
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [doctorName, setDoctorName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/bookings/${params.id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Erro");
        setBooking(data.booking);
        setDoctorName(data.doctor?.name || "");
      })
      .catch((e) => setError(e.message));
  }, [params.id]);

  if (error) {
    return <div className="mx-auto max-w-xl px-5 py-20 text-red-300">{error}</div>;
  }
  if (!booking) {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-[var(--text-muted)]">
        Carregando confirmação…
      </div>
    );
  }

  const meetingUrl = `/consulta/${booking.meetingRoomId}`;

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--green)]">
        Pagamento confirmado
      </p>
      <h1 className="font-display mt-2 text-4xl text-[var(--text)]">
        Consulta liberada
      </h1>
      <p className="mt-4 text-[var(--text-soft)]">
        Enviamos um e-mail para <strong>{booking.patientEmail}</strong> com o
        link da sala online.
      </p>

      <div className="panel mt-8 space-y-3 text-sm">
        <p>
          <span className="text-[var(--text-muted)]">Paciente:</span>{" "}
          <span className="text-[var(--text)]">{booking.patientName}</span>
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Médico(a):</span>{" "}
          <span className="text-[var(--text)]">{doctorName}</span>
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Horário:</span>{" "}
          <span className="text-[var(--text)]">{formatSlotLabel(booking.slotStart)}</span>
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Valor:</span>{" "}
          <span className="text-[var(--gold)]">{formatBRL(booking.priceCents)}</span>
        </p>
        <p className="rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-3 text-[var(--gold-light)]">
          O valor foi direcionado à conta do médico (menos a taxa da plataforma
          de demonstração de 5%).
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={meetingUrl} className="btn-gold">
          Abrir sala da consulta
        </Link>
        <Link href="/" className="btn-ghost">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
