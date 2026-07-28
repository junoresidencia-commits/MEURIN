import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/store";
import type { PaymentMethod } from "@/lib/types";

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

  const booking = {
    id: uuid(),
    doctorId,
    patientName: String(patientName),
    patientEmail: String(patientEmail).toLowerCase(),
    patientPhone: String(patientPhone || ""),
    slotStart: String(slotStart),
    slotEnd: String(slotEnd),
    priceCents: doctor.consultationPriceCents,
    paymentMethod: paymentMethod as PaymentMethod,
    status: "pending_payment" as const,
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
