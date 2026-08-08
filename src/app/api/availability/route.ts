import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { generateSlotsForDoctor } from "@/lib/scheduling";
import { logFinancialEvent, readDb, updateDb } from "@/lib/store";
import type { WeeklySlot } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  if (!doctorId) {
    return NextResponse.json({ error: "doctorId obrigatório" }, { status: 400 });
  }
  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) {
    return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
  }

  const bookedStarts = new Set(
    db.bookings
      .filter(
        (b) =>
          b.doctorId === doctorId &&
          ["pending_payment", "paid", "confirmed"].includes(b.status)
      )
      .map((b) => b.slotStart)
  );

  const doctorWithBooked = {
    ...doctor,
    blockedSlots: [...doctor.blockedSlots, ...bookedStarts],
  };

  return NextResponse.json({
    slots: generateSlotsForDoctor(doctorWithBooked),
    weeklyAvailability: doctor.weeklyAvailability,
  });
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const body = await req.json();
  const weeklyAvailability = body.weeklyAvailability as WeeklySlot[] | undefined;
  const consultationPriceCents = body.consultationPriceCents as number | undefined;
  const bio = body.bio as string | undefined;
  // Segurança: o médico NÃO pode alterar o próprio percentual de repasse nem a
  // liberação financeira — mesmo enviando esses campos diretamente na API, eles
  // são ignorados aqui. Só o administrador altera (via /api/admin/doctors).

  const db = await readDb();
  const before = db.doctors.find((d) => d.id === doctorId);
  const newPrice =
    typeof consultationPriceCents === "number" && Number.isFinite(consultationPriceCents)
      ? Math.max(0, Math.round(consultationPriceCents))
      : undefined;

  await updateDb((current) => ({
    ...current,
    doctors: current.doctors.map((d) =>
      d.id === doctorId
        ? {
            ...d,
            weeklyAvailability: weeklyAvailability ?? d.weeklyAvailability,
            consultationPriceCents: newPrice ?? d.consultationPriceCents,
            bio: bio ?? d.bio,
          }
        : d
    ),
  }));

  // Histórico do preço (o médico controla o próprio valor da consulta).
  if (before && newPrice !== undefined && newPrice !== before.consultationPriceCents) {
    await logFinancialEvent({
      doctorId,
      kind: "price",
      oldValue: String(before.consultationPriceCents),
      newValue: String(newPrice),
      changedBy: "medico",
    });
  }

  return NextResponse.json({ ok: true });
}
