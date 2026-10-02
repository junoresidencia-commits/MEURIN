"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShareButton } from "@/components/ShareButton";
import { PixCheckout } from "@/components/PixCheckout";
import { formatBRL, formatSlotLabel } from "@/lib/scheduling-client";
import { whatsappLink } from "@/lib/contact";
import type { Booking } from "@/lib/types";

const REASON_LABEL: Record<Booking["careReason"], string> = {
  pressa: "Com pressa / horário próximo",
  acompanhamento: "Acompanhamento",
  segunda_opiniao: "Segunda opinião",
  outro: "Consulta online",
};

type PixInfo = {
  brCode: string;
  qrDataUrl: string;
  amountCents: number;
  holderName: string;
  doctorName?: string;
};

export default function ConfirmacaoPage() {
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [doctorName, setDoctorName] = useState("");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const [pix, setPix] = useState<PixInfo | null>(null);
  const [pixHint, setPixHint] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function loadPix(bookingId: string) {
      try {
        const r = await fetch(`/api/payments?bookingId=${encodeURIComponent(bookingId)}`);
        const data = await r.json();
        if (r.ok && data.brCode) {
          setPix({
            brCode: data.brCode,
            qrDataUrl: data.qrDataUrl || "",
            amountCents: data.amountCents,
            holderName: data.holderName,
            doctorName: data.doctorName,
          });
        }
      } catch {
        /* QR é complementar — a página ainda mostra o status */
      }
    }

    async function fetchBooking() {
      try {
        const r = await fetch(`/api/bookings/${params.id}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Erro");
        if (cancelled) return;
        setBooking(data.booking);
        setDoctorName(data.doctor?.name || "");
        if (data.booking?.status === "pending_payment") {
          void loadPix(data.booking.id);
        }
        if (data.booking?.status !== "confirmed" && tries < 20) {
          tries += 1;
          timer = setTimeout(fetchBooking, 3000);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro");
      }
    }

    fetchBooking();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [params.id]);

  if (error) {
    return <div className="mx-auto max-w-xl px-5 py-20 text-[var(--danger)]">{error}</div>;
  }
  if (!booking) {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-[var(--text-muted)]">
        Carregando confirmação…
      </div>
    );
  }

  if (booking.status === "pending_payment") {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--warn)]">
          Pagamento pendente
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">
          Pague com Pix para liberar a consulta
        </h1>
        <p className="mt-4 text-[var(--text-soft)]">
          Se o Mercado Pago não abriu ou o botão Pagar ficou cinza, use o QR Code
          abaixo. O valor vai para a chave cadastrada por{" "}
          <strong className="text-[var(--text)]">{doctorName || "o médico"}</strong>.
        </p>
        {pix ? (
          <div className="mt-6">
            {pixHint && <p className="mb-3 text-sm text-[var(--green)]">{pixHint}</p>}
            <PixCheckout
              pix={pix}
              onPaid={async () => {
                const res = await fetch("/api/payments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ bookingId: booking.id, pixDeclared: true }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Não foi possível confirmar o Pix.");
                setPixHint("Pix informado. Atualizando…");
                window.location.reload();
              }}
            />
          </div>
        ) : (
          <div className="panel mt-6 space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Este médico ainda não cadastrou chave Pix. Tente o checkout do Mercado Pago
              de novo ou fale com a clínica.
            </p>
            <button
              type="button"
              className="btn-gold min-h-12 w-full"
              onClick={async () => {
                const res = await fetch("/api/payments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ bookingId: booking.id }),
                });
                const data = await res.json().catch(() => ({}));
                if (data.redirectUrl) {
                  window.location.href = data.redirectUrl;
                  return;
                }
                if (data.brCode) {
                  setPix({
                    brCode: data.brCode,
                    qrDataUrl: data.qrDataUrl || "",
                    amountCents: data.amountCents,
                    holderName: data.holderName,
                    doctorName: data.doctorName,
                  });
                  return;
                }
                setError(data.error || "Não foi possível reabrir o pagamento.");
              }}
            >
              Tentar Mercado Pago de novo
            </button>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>
            Já paguei — atualizar
          </button>
          <Link href="/minhas-consultas" className="btn-ghost">Minhas consultas</Link>
        </div>
      </div>
    );
  }

  // Após o pagamento, a consulta aguarda a confirmação do médico (não libera sozinha).
  if (booking.status !== "confirmed") {
    const awaitingDoctor = booking.status === "paid";
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--warn)]">
          {awaitingDoctor ? "Pagamento confirmado" : "Pagamento em processamento"}
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">
          {awaitingDoctor ? "Aguardando a confirmação do médico" : "Estamos confirmando seu pagamento"}
        </h1>
        <p className="mt-4 text-[var(--text-soft)]">
          {awaitingDoctor
            ? "Recebemos o seu pagamento. O médico vai confirmar o horário (ou propor outro). Assim que confirmar, o link da sala é liberado aqui e enviado para "
            : "Assim que o pagamento for aprovado, o médico será avisado para confirmar. Você também receberá por e-mail em "}
          <strong className="text-[var(--text)]">{booking.patientEmail}</strong>.
        </p>
        <div className="panel mt-6 flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
          <span className="text-sm text-[var(--text-muted)]">
            {awaitingDoctor ? "Aguardando o médico confirmar…" : "Aguardando confirmação do pagamento…"}
          </span>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>
            Atualizar agora
          </button>
          <Link href="/minhas-consultas" className="btn-ghost">Minhas consultas</Link>
        </div>
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
        <p className="break-all rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-3 text-[var(--gold)]">
          Link da sala: {meetingAbsolute}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 print:hidden">
        <Link href={meetingPath} className="btn-gold">
          Abrir sala da consulta
        </Link>
        <a
          className="btn-ghost"
          href={whatsappLink(
            `Consulta Meu Rim confirmada.\n${formatSlotLabel(booking.slotStart)}\nSala: ${meetingAbsolute}`
          )}
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
