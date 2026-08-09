import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/store";
import { generateAvailableSlots } from "@/lib/scheduling";
import { activeHoldStarts } from "@/lib/holds-store";
import { sendNotification, patientKey, links, fmtDateTime } from "@/lib/notify";
import type { Booking, Modality } from "@/lib/types";

/**
 * O MÉDICO agenda uma consulta diretamente (na Agenda), já CONFIRMADA — ocupa o
 * horário. Reaproveita a disponibilidade real (evita dupla marcação/horário inválido).
 */
export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
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
  if (conflict) return NextResponse.json({ error: "Já existe consulta neste horário." }, { status: 409 });

  const modality = (b.modality === "presencial" || b.modality === "teleconsulta") ? (b.modality as Modality) : undefined;
  const locationId = b.locationId ? String(b.locationId) : undefined;
  const held = await activeHoldStarts(doctorId);
  const slots = generateAvailableSlots(doctor, { modality, locationId, excludeStarts: held });
  const slot = slots.find((s) => s.start === iso);
  if (!slot) return NextResponse.json({ error: "Horário fora da sua agenda ou indisponível." }, { status: 409 });

  const nowIso = new Date().toISOString();
  const booking: Booking = {
    id: uuid(),
    doctorId,
    patientName,
    patientEmail: b.patientEmail ? String(b.patientEmail).toLowerCase().trim() : "",
    patientPhone: b.patientPhone ? String(b.patientPhone).trim() : "",
    patientCity: "",
    careReason: "acompanhamento",
    slotStart: slot.start,
    slotEnd: slot.end,
    priceCents: slot.priceCents,
    paymentMethod: "pix",
    status: "confirmed", // agendada pelo médico já entra confirmada
    meetingRoomId: uuid(),
    confirmationEmailSent: false,
    createdAt: nowIso,
    modality: slot.modality,
    locationId: slot.locationId,
    locationName: slot.locationName,
    stage: "confirmada",
    events: [
      { at: nowIso, actor: "medico", type: "solicitada", detail: "Consulta agendada pelo médico." },
      { at: nowIso, actor: "medico", type: "confirmada", detail: "Confirmada." },
    ],
  };
  await updateDb((cur) => ({ ...cur, bookings: [...cur.bookings, booking] }));

  if (booking.patientEmail) {
    await sendNotification({
      userId: patientKey(booking.patientEmail),
      role: "paciente",
      type: "consulta_agendada",
      title: "Consulta agendada",
      body: `${doctor.name} agendou sua consulta para ${fmtDateTime(booking.slotStart, doctor.tz)}.`,
      targetUrl: links.patientConsulta(booking.id),
      tag: `booking-${booking.id}`,
      relatedType: "booking",
      relatedId: booking.id,
    });
  }
  return NextResponse.json({ ok: true, booking }, { status: 201 });
}
