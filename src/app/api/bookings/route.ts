import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb, updateDb, updateBooking, deleteBooking } from "@/lib/store";
import { appOrigin } from "@/lib/payments";
import { buildConfirmationEmail, sendEmail } from "@/lib/email";
import { generateAvailableSlots } from "@/lib/scheduling";
import { activeHoldStarts, releaseHold } from "@/lib/holds-store";
import { processReminders } from "@/lib/reminders";
import type { Booking, ConsultationEvent, Modality, PaymentMethod } from "@/lib/types";

const REASONS = new Set(["pressa", "acompanhamento", "segunda_opiniao", "outro"]);

function ev(actor: ConsultationEvent["actor"], type: string, detail?: string): ConsultationEvent {
  return { at: new Date().toISOString(), actor, type, detail };
}
function isFutureIso(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const t = new Date(v).getTime();
  return !Number.isNaN(t);
}

export async function GET() {
  const doctorId = await getDoctorSessionId();
  const db = await readDb();

  if (doctorId) {
    const mine = db.bookings
      .filter((b) => b.doctorId === doctorId)
      .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
    // Dispara lembretes 24h/2h pendentes (best-effort ao abrir a agenda).
    const processed = await processReminders(mine);
    return NextResponse.json({ bookings: processed });
  }

  return NextResponse.json({ bookings: [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    doctorId,
    patientName,
    patientEmail,
    patientPhone,
    patientCity,
    careReason,
    slotStart,
    slotEnd,
    paymentMethod,
  } = body;

  if (
    !doctorId ||
    !patientName ||
    !patientEmail ||
    !slotStart ||
    !slotEnd ||
    !paymentMethod
  ) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }

  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) {
    return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  }

  const iso = new Date(String(slotStart)).toISOString();
  const holder = body.holder ? String(body.holder).slice(0, 80) : "";

  const conflict = db.bookings.some(
    (b) =>
      b.doctorId === doctorId &&
      new Date(b.slotStart).toISOString() === iso &&
      ["pending_payment", "paid", "confirmed"].includes(b.status)
  );
  if (conflict) {
    return NextResponse.json(
      { error: "Este horário acabou de ficar indisponível. Escolha outro." },
      { status: 409 }
    );
  }

  // Reverificação no backend: o horário precisa existir na agenda real do médico e
  // não estar reservado por outra pessoa (anti dupla marcação). Também define o
  // valor autoritativo por local/modalidade.
  const held = await activeHoldStarts(doctorId, holder); // exclui a própria reserva
  const requestedModality = (body.modality === "presencial" || body.modality === "teleconsulta") ? (body.modality as Modality) : undefined;
  const requestedLocation = body.locationId ? String(body.locationId) : undefined;
  const slots = generateAvailableSlots(doctor, { modality: requestedModality, locationId: requestedLocation, excludeStarts: held });
  const slot = slots.find((s) => s.start === iso);
  if (!slot) {
    return NextResponse.json(
      { error: "Este horário não está mais disponível. Escolha outro." },
      { status: 409 }
    );
  }

  const reason = REASONS.has(careReason) ? careReason : "outro";

  const booking: Booking = {
    id: uuid(),
    doctorId,
    patientName: String(patientName),
    patientEmail: String(patientEmail).toLowerCase(),
    patientPhone: String(patientPhone || ""),
    patientCity: String(patientCity || ""),
    careReason: reason as Booking["careReason"],
    slotStart: slot.start,
    slotEnd: slot.end,
    priceCents: slot.priceCents, // valor por local/modalidade
    paymentMethod: paymentMethod as PaymentMethod,
    status: "pending_payment",
    meetingRoomId: uuid(),
    confirmationEmailSent: false,
    createdAt: new Date().toISOString(),
    modality: slot.modality,
    locationId: slot.locationId,
    locationName: slot.locationName,
    events: [ev("paciente", "solicitada", `Paciente solicitou a consulta (${slot.modality === "presencial" ? `presencial — ${slot.locationName ?? "clínica"}` : "teleconsulta"}).`)],
  };

  await updateDb((current) => ({
    ...current,
    bookings: [...current.bookings, booking],
  }));

  // Libera a reserva temporária deste paciente (a consulta agora ocupa o horário).
  if (holder) await releaseHold(doctorId, iso, holder);

  return NextResponse.json({ booking }, { status: 201 });
}

// Ações do MÉDICO sobre a consulta (dono da consulta, autenticado).
export async function PATCH(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const action = String(body.action || "");
  const db = await readDb();
  const booking = db.bookings.find((b) => b.id === id);
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!booking || booking.doctorId !== doctorId || !doctor) {
    return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  }
  const events = booking.events ?? [];

  if (action === "confirm") {
    const updated = await updateBooking(id, {
      status: "confirmed",
      stage: "confirmada",
      confirmationEmailSent: true,
      proposedSlotStart: undefined,
      proposedSlotEnd: undefined,
      proposalMessage: undefined,
      proposalBy: undefined,
      events: [...events, ev("medico", "confirmada", "Consulta confirmada pelo médico.")],
    });
    if (booking.patientEmail?.includes("@") && updated) {
      const meetingUrl = `${appOrigin()}/consulta/${booking.meetingRoomId}`;
      await sendEmail(buildConfirmationEmail(updated, doctor, meetingUrl));
    }
    return NextResponse.json({ ok: true, booking: updated });
  }

  if (action === "propose") {
    if (!isFutureIso(body.slotStart) || !isFutureIso(body.slotEnd)) {
      return NextResponse.json({ error: "Informe a nova data e horário." }, { status: 400 });
    }
    const msg = typeof body.message === "string" ? body.message.trim() : "";
    const updated = await updateBooking(id, {
      stage: "proposto_novo_horario",
      proposedSlotStart: String(body.slotStart),
      proposedSlotEnd: String(body.slotEnd),
      proposalMessage: msg || undefined,
      proposalBy: "medico",
      events: [...events, ev("medico", "proposta", `Médico propôs novo horário: ${new Date(String(body.slotStart)).toLocaleString("pt-BR")}.`)],
    });
    if (booking.patientEmail?.includes("@")) {
      await sendEmail({
        to: booking.patientEmail,
        subject: "Proposta de novo horário — Meu Rim",
        body: `${doctor.name} propôs um novo horário para sua consulta. Acesse o Meu Rim para aceitar ou recusar.${msg ? `\n\nMensagem: ${msg}` : ""}`,
      });
    }
    return NextResponse.json({ ok: true, booking: updated });
  }

  if (action === "reschedule") {
    // Remarcação SEM nova cobrança: mantém pagamento/paymentId; só muda o horário.
    if (!isFutureIso(body.slotStart) || !isFutureIso(body.slotEnd)) {
      return NextResponse.json({ error: "Informe a nova data e horário." }, { status: 400 });
    }
    const fromLabel = new Date(booking.slotStart).toLocaleString("pt-BR");
    const toLabel = new Date(String(body.slotStart)).toLocaleString("pt-BR");
    const wasPaid = ["paid", "confirmed", "completed"].includes(booking.status);
    const updated = await updateBooking(id, {
      slotStart: String(body.slotStart),
      slotEnd: String(body.slotEnd),
      // status/paymentId preservados — nenhuma nova cobrança.
      stage: booking.status === "confirmed" ? "confirmada" : "remarcada",
      proposedSlotStart: undefined,
      proposedSlotEnd: undefined,
      proposalMessage: undefined,
      proposalBy: undefined,
      notRealizedReason: undefined,
      events: [...events, ev("medico", "remarcada", `Consulta remarcada de ${fromLabel} para ${toLabel}.${wasPaid ? " Pagamento preservado (sem nova cobrança)." : ""}`)],
    });
    if (booking.patientEmail?.includes("@")) {
      await sendEmail({
        to: booking.patientEmail,
        subject: "Consulta remarcada — Meu Rim",
        body: `Sua consulta foi remarcada para ${toLabel}.${wasPaid ? " O pagamento anterior continua válido — não há nova cobrança." : ""}`,
      });
    }
    return NextResponse.json({ ok: true, booking: updated });
  }

  if (action === "not_realized") {
    const reason = typeof body.reason === "string" ? body.reason.trim() : "outro";
    const updated = await updateBooking(id, {
      stage: "nao_realizada",
      notRealizedReason: reason,
      events: [...events, ev("medico", "nao_realizada", `Consulta não realizada (${reason}).`)],
    });
    return NextResponse.json({ ok: true, booking: updated });
  }

  if (action === "cancel") {
    const updated = await updateBooking(id, {
      status: "cancelled",
      stage: "cancelada",
      events: [...events, ev("medico", "cancelada", "Consulta cancelada pelo médico.")],
    });
    return NextResponse.json({ ok: true, booking: updated });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const id = String(body.id || "");
  const db = await readDb();
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking || booking.doctorId !== doctorId) {
    return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  }
  await deleteBooking(id);
  return NextResponse.json({ ok: true });
}
