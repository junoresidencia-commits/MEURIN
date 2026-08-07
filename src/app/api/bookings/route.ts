import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb, updateDb, deleteBooking } from "@/lib/store";
import type { Booking, PaymentMethod } from "@/lib/types";

const REASONS = new Set(["pressa", "acompanhamento", "segunda_opiniao", "outro"]);

export async function GET() {
  const doctorId = await getDoctorSessionId();
  const db = await readDb();

  if (doctorId) {
    const mine = db.bookings
      .filter((b) => b.doctorId === doctorId)
      .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
    return NextResponse.json({ bookings: mine });
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

  const conflict = db.bookings.some(
    (b) =>
      b.doctorId === doctorId &&
      b.slotStart === slotStart &&
      ["pending_payment", "paid", "confirmed"].includes(b.status)
  );
  if (conflict) {
    return NextResponse.json(
      { error: "Este horário acabou de ser reservado. Escolha outro." },
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
    slotStart: String(slotStart),
    slotEnd: String(slotEnd),
    priceCents: doctor.consultationPriceCents,
    paymentMethod: paymentMethod as PaymentMethod,
    status: "pending_payment",
    meetingRoomId: uuid(),
    confirmationEmailSent: false,
    createdAt: new Date().toISOString(),
  };

  await updateDb((current) => ({
    ...current,
    bookings: [...current.bookings, booking],
  }));

  return NextResponse.json({ booking }, { status: 201 });
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
