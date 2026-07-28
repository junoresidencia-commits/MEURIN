"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShareButton } from "@/components/ShareButton";
import { formatBRL, formatSlotLabel } from "@/lib/scheduling-client";
import type { Booking } from "@/lib/types";

const REASON_LABEL: Record<Booking["careReason"], string> = {
  pressa: "Com pressa / horário próximo",
  acompanhamento: "Acompanhamento",
  segunda_opiniao: "Segunda opinião",
  outro: "Consulta online",
};

export default function ConfirmacaoPage() {
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [doctorName, setDoctorName] = useState("");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
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

  const meetingPath = `/consulta/${booking.meetingRoomId}`;
  const meetingAbsolute = origin ? `${origin}${meetingPath}` : meetingPath;
  const shareText = `Minha consulta de nefrologia na Meu Rim está confirmada com ${doctorName}. Se você também precisa de atendimento online (interior, fila ou pressa), conheça:`;

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--green)]">
        Tudo certo — consulta liberada
      </p>
      <h1 className="font-display mt-2 text-4xl text-[var(--text)]">
        Você já pode entrar na sala
      </h1>
      <p className="mt-4 text-[var(--text-soft)]">
        Enviamos o link para <strong className="text-[var(--text)]">{booking.patientEmail}</strong>.
        Guarde este e-mail. No horário, paciente e médico entram pela Meu Rim —
        sem Zoom.
      </p>

      <div className="panel mt-8 space-y-3 text-sm">
        <p>
          <span className="text-[var(--text-muted)]">Paciente:</span>{" "}
          <span className="text-[var(--text)]">{booking.patientName}</span>
        </p>
        {booking.patientCity && (
          <p>
            <span className="text-[var(--text-muted)]">Cidade:</span>{" "}
            <span className="text-[var(--text)]">{booking.patientCity}</span>
          </p>
        )}
        <p>
          <span className="text-[var(--text-muted)]">Motivo:</span>{" "}
          <span className="text-[var(--text)]">
            {REASON_LABEL[booking.careReason] || "Consulta online"}
          </span>
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
        <p className="break-all rounded-xl border border-[var(--border)] bg-black/30 p-3 text-[var(--gold-light)]">
          Link da sala: {meetingAbsolute}
        </p>
        <p className="rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-3 text-[var(--gold-light)]">
          Pagamento direcionado à conta do médico (demo: 95% médico / 5%
          plataforma).
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 print:hidden">
        <Link href={meetingPath} className="btn-gold">
          Abrir sala da consulta
        </Link>
        <a
          className="btn-ghost"
          href={`https://wa.me/?text=${encodeURIComponent(
            `Consulta Meu Rim confirmada.\n${formatSlotLabel(booking.slotStart)}\nSala: ${meetingAbsolute}`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mandar link no WhatsApp
        </a>
        <button type="button" className="btn-ghost" onClick={() => window.print()}>
          Imprimir / salvar PDF
        </button>
      </div>

      <div className="mt-10 border-t border-[var(--border)] pt-8 print:hidden">
        <h2 className="font-display text-2xl text-[var(--text)]">
          Ajude alguém do interior ou da fila
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Se a Meu Rim resolveu para você, compartilhe. Tem muita gente longe de
          nefrologista ou sem tempo de deslocar.
        </p>
        <div className="mt-5">
          <ShareButton text={shareText} />
        </div>
      </div>
    </div>
  );
}
