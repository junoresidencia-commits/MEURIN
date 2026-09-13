import { NextResponse } from "next/server";
import { requireAttendantForDoctor, hasPerm } from "@/lib/attendant-context";
import { getDoctorById, listBookingsForDoctor } from "@/lib/store";
import { generateAvailableSlots } from "@/lib/scheduling";
import { activeHoldStarts } from "@/lib/holds-store";
import type { Modality } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId") || "";
  const modality = (searchParams.get("modality") || undefined) as Modality | undefined;
  const locationId = searchParams.get("locationId") || undefined;
  if (!doctorId) return NextResponse.json({ error: "doctorId obrigatório." }, { status: 400 });
  const ctx = await requireAttendantForDoctor(doctorId);
  if (!ctx) return NextResponse.json({ error: "Sem acesso a este médico." }, { status: 403 });
  if (!hasPerm(ctx.link, "verHorarios")) return NextResponse.json({ error: "Sem permissão para ver horários." }, { status: 403 });

  const [doctor, mine] = await Promise.all([getDoctorById(doctorId), listBookingsForDoctor(doctorId)]);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });

  const bookedStarts = mine
    .filter((b) => ["pending_payment", "paid", "confirmed"].includes(b.status))
    .map((b) => new Date(b.slotStart).toISOString());
  const held = await activeHoldStarts(doctorId);
  const excludeStarts = new Set<string>([...bookedStarts, ...held]);

  const slots = generateAvailableSlots(doctor, { modality, locationId, excludeStarts });
  const locations = (doctor.locations || []).filter((l) => l.active);
  return NextResponse.json({ slots, locations });
}
