import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById, updateDb } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import type { Booking } from "@/lib/types";
import { consumeCourtesyCredit } from "@/lib/courtesy-credits-store";
import { courtesyLabel, isCourtesyKind } from "@/lib/courtesy";

const REASONS = new Set(["pressa", "acompanhamento", "segunda_opiniao", "outro"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const doctorId = await getDoctorSessionId();
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  }

  const doctor = doctorId ? await getDoctorById(doctorId) : null;
  if (!doctor) {
    return NextResponse.json({ error: "Médico não encontrado." }, { status: 403 });
  }

  const body = await req.json();
  const slotStart = body.slotStart ? new Date(String(body.slotStart)) : null;
  if (!slotStart || Number.isNaN(slotStart.getTime())) {
    return NextResponse.json({ error: "Data/hora inválida." }, { status: 400 });
  }
  const durationMin = Number(body.durationMin) || 30;
  const slotEnd = new Date(slotStart.getTime() + durationMin * 60000);
  const reason = REASONS.has(body.careReason) ? body.careReason : "acompanhamento";
  const courtesyKind = isCourtesyKind(body.courtesyKind) ? body.courtesyKind : undefined;
  const patientEmail = (access.email || access.key).toLowerCase();

  const booking: Booking = {
    id: uuid(),
    doctorId: doctor.id,
    patientName: access.name || "Paciente",
    patientEmail,
    patientPhone: access.phone || "",
    patientCity: access.city || "",
    careReason: reason as Booking["careReason"],
    slotStart: slotStart.toISOString(),
    slotEnd: slotEnd.toISOString(),
    priceCents: courtesyKind ? 0 : doctor.consultationPriceCents,
    paymentMethod: "pix",
    // Agendado pelo próprio médico: já confirmado, sem cobrança online.
    status: "confirmed",
    meetingRoomId: uuid(),
    confirmationEmailSent: false,
    createdAt: new Date().toISOString(),
    courtesyKind,
    stage: "confirmada",
    events: courtesyKind
      ? [{ at: new Date().toISOString(), actor: "medico", type: "confirmada", detail: `${courtesyLabel(courtesyKind)} agendado pelo médico. Sem cobrança.` }]
      : undefined,
  };

  await updateDb((current) => ({ ...current, bookings: [...current.bookings, booking] }));
  if (courtesyKind) {
    const used =
      (await consumeCourtesyCredit(doctor.id, access.key, booking.id)) ||
      (await consumeCourtesyCredit(doctor.id, patientEmail, booking.id));
    void used;
  }
  return NextResponse.json({ ok: true, booking }, { status: 201 });
}
