import { NextResponse } from "next/server";
import { readDb, updateBooking } from "@/lib/store";
import { appOrigin } from "@/lib/payments";
import { buildConfirmationEmail, sendEmail } from "@/lib/email";
import type { ConsultationEvent } from "@/lib/types";

function ev(actor: ConsultationEvent["actor"], type: string, detail?: string): ConsultationEvent {
  return { at: new Date().toISOString(), actor, type, detail };
}

/** Paciente aceita/recusa a proposta de novo horário. Remarcação NÃO gera nova cobrança. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const db = await readDb();
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  if (booking.stage !== "proposto_novo_horario" || !booking.proposedSlotStart) {
    return NextResponse.json({ error: "Não há proposta de horário pendente." }, { status: 400 });
  }
  const doctor = db.doctors.find((d) => d.id === booking.doctorId);
  const events = booking.events ?? [];

  if (action === "accept") {
    const fromLabel = new Date(booking.slotStart).toLocaleString("pt-BR");
    const toLabel = new Date(booking.proposedSlotStart).toLocaleString("pt-BR");
    const paid = ["paid", "confirmed", "completed"].includes(booking.status);
    const updated = await updateBooking(id, {
      slotStart: booking.proposedSlotStart,
      slotEnd: booking.proposedSlotEnd || booking.slotEnd,
      // Aceitou o novo horário proposto pelo médico => consulta confirmada.
      status: paid ? "confirmed" : booking.status,
      stage: "confirmada",
      confirmationEmailSent: paid,
      proposedSlotStart: undefined,
      proposedSlotEnd: undefined,
      proposalMessage: undefined,
      proposalBy: undefined,
      events: [...events, ev("paciente", "remarcada", `Paciente aceitou o novo horário. Remarcada de ${fromLabel} para ${toLabel}.${paid ? " Pagamento preservado (sem nova cobrança)." : ""}`)],
    });
    if (updated && doctor && booking.patientEmail?.includes("@") && paid) {
      const meetingUrl = `${appOrigin()}/consulta/${booking.meetingRoomId}`;
      await sendEmail(buildConfirmationEmail(updated, doctor, meetingUrl));
    }
    if (doctor?.email) {
      await sendEmail({ to: doctor.email, subject: "Paciente aceitou o novo horário", body: `${booking.patientName} aceitou o novo horário (${toLabel}).` });
    }
    return NextResponse.json({ ok: true, booking: updated });
  }

  if (action === "decline") {
    const updated = await updateBooking(id, {
      stage: "aguardando_confirmacao",
      proposedSlotStart: undefined,
      proposedSlotEnd: undefined,
      proposalMessage: undefined,
      proposalBy: undefined,
      events: [...events, ev("paciente", "proposta_recusada", "Paciente não pôde no horário proposto.")],
    });
    if (doctor?.email) {
      await sendEmail({ to: doctor.email, subject: "Paciente recusou o novo horário", body: `${booking.patientName} não pôde no horário proposto. Combine outro horário ou proponha novamente.` });
    }
    return NextResponse.json({ ok: true, booking: updated });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
