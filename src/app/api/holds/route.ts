import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";
import { activeHoldStarts, createHold, isHeldByOther, releaseHold } from "@/lib/holds-store";
import { generateAvailableSlots } from "@/lib/scheduling";

/**
 * Reserva temporária de um horário (anti dupla marcação). O `holder` é um token do
 * navegador do paciente (gerado no cliente) para identificar/soltar a própria reserva.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const doctorId = String(b.doctorId || "");
  const slotStart = String(b.slotStart || "");
  const holder = String(b.holder || "").slice(0, 80);
  if (!doctorId || !slotStart || !holder) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }
  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });

  const iso = new Date(slotStart).toISOString();
  const booked = db.bookings.some(
    (x) => x.doctorId === doctorId && new Date(x.slotStart).toISOString() === iso && ["pending_payment", "paid", "confirmed"].includes(x.status)
  );
  if (booked || (await isHeldByOther(doctorId, iso, holder))) {
    return NextResponse.json({ error: "Este horário acabou de ficar indisponível. Escolha outro." }, { status: 409 });
  }
  // Confirma que o horário pertence à agenda real do médico.
  const excludeStarts = await activeHoldStarts(doctorId, holder);
  const slots = generateAvailableSlots(doctor, { excludeStarts });
  const slot = slots.find((s) => s.start === iso);
  if (!slot) {
    return NextResponse.json({ error: "Horário indisponível na agenda do médico." }, { status: 409 });
  }

  const hold = await createHold(doctorId, iso, holder);
  return NextResponse.json({ ok: true, holdId: hold.id, expiresAt: hold.expiresAt });
}

export async function DELETE(req: Request) {
  const b = await req.json().catch(() => ({}));
  const doctorId = String(b.doctorId || "");
  const slotStart = String(b.slotStart || "");
  const holder = String(b.holder || "");
  if (!doctorId || !slotStart) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  await releaseHold(doctorId, new Date(slotStart).toISOString(), holder || undefined);
  return NextResponse.json({ ok: true });
}
