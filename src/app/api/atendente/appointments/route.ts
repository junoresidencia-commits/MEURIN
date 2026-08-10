import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { requireAttendantForDoctor, hasPerm } from "@/lib/attendant-context";
import { readDb, updateDb } from "@/lib/store";
import { generateAvailableSlots } from "@/lib/scheduling";
import { activeHoldStarts } from "@/lib/holds-store";
import { sendNotification, patientKey, links, fmtDateTime } from "@/lib/notify";
import type { Booking, Modality } from "@/lib/types";

/** A ATENDENTE agenda uma consulta em nome do médico (já confirmada, ocupa o horário).
 *  Reaproveita a agenda real (anti dupla marcação) — mesma agenda única do médico. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const doctorId = String(b.doctorId || "");
  if (!doctorId) return NextResponse.json({ error: "doctorId obrigatório." }, { status: 400 });
  const ctx = await requireAttendantForDoctor(doctorId);
  if (!ctx) return NextResponse.json({ error: "Sem acesso a este médico." }, { status: 403 });
  if (!hasPerm(ctx.link, "agendar")) return NextResponse.json({ error: "Sem permissão para agendar." }, { status: 403 });

  const patientName = String(b.patientName || "").trim();
  const slotStart = String(b.slotStart || "");
  if (!patientName) return NextResponse.json({ error: "Informe o nome do paciente." }, { status: 400 });
  const t = new Date(slotStart).getTime();
  if (Number.isNaN(t)) return NextResponse.json({ error: "Horário inválido." }, { status: 400 });
  const iso = new Date(t).toISOString();

  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });

  const conflict = db.bookings.some(
    (x) => x.doctorId === doctorId && new Date(x.slotStart).toISOString() === iso && ["pending_payment", "paid", "confirmed"].includes(x.status)
  );
  if (conflict) return NextResponse.json({ error: "Este horário acabou de ser reservado. Escolha outro horário." }, { status: 409 });

  const modality = (b.modality === "presencial" || b.modality === "teleconsulta") ? (b.modality as Modality) : undefined;
  const locationId = b.locationId ? String(b.locationId) : undefined;
  const held = await activeHoldStarts(doctorId);
  const slots = generateAvailableSlots(doctor, { modality, locationId, excludeStarts: held });
  const slot = slots.find((s) => s.start === iso);
  if (!slot) return NextResponse.json({ error: "Horário fora da agenda do médico ou indisponível." }, { status: 409 });

  const nowIso = new Date().toISOString();
  const booking: Booking = {
    id: uuid(), doctorId, patientName,
    patientEmail: b.patientEmail ? String(b.patientEmail).toLowerCase().trim() : "",
    patientPhone: b.patientPhone ? String(b.patientPhone).trim() : "",
    patientCity: "", careReason: "acompanhamento",
    slotStart: slot.start, slotEnd: slot.end, priceCents: slot.priceCents,
    paymentMethod: "pix", status: "confirmed", meetingRoomId: uuid(),
    confirmationEmailSent: false, createdAt: nowIso,
    modality: slot.modality, locationId: slot.locationId, locationName: slot.locationName,
    stage: "confirmada",
    events: [
      { at: nowIso, actor: "medico", type: "solicitada", detail: `Consulta agendada por ${ctx.attendant.name} (atendente).` },
      { at: nowIso, actor: "medico", type: "confirmada", detail: "Confirmada." },
    ],
  };
  await updateDb((cur) => ({ ...cur, bookings: [...cur.bookings, booking] }));

  const { logAttendantAudit } = await import("@/lib/attendants-store");
  await logAttendantAudit({ attendantId: ctx.attendant.id, attendantName: ctx.attendant.name, doctorId, action: "agendar", bookingId: booking.id, patientKey: booking.patientEmail, detail: `Agendou ${patientName} para ${fmtDateTime(booking.slotStart, doctor.tz)}.` });

  if (booking.patientEmail) {
    await sendNotification({
      userId: patientKey(booking.patientEmail), role: "paciente", type: "consulta_agendada",
      title: "Consulta agendada",
      body: `Sua consulta com ${doctor.name} foi agendada para ${fmtDateTime(booking.slotStart, doctor.tz)}.`,
      targetUrl: links.patientConsulta(booking.id), tag: `booking-${booking.id}`, relatedType: "booking", relatedId: booking.id,
    });
  }
  return NextResponse.json({ ok: true, booking: { id: booking.id, slotStart: booking.slotStart } }, { status: 201 });
}
