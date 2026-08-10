import { NextResponse } from "next/server";
import { requireAttendantForDoctor, hasPerm } from "@/lib/attendant-context";
import { readDb } from "@/lib/store";

export async function GET(req: Request) {
  const doctorId = new URL(req.url).searchParams.get("doctorId") || "";
  if (!doctorId) return NextResponse.json({ error: "doctorId obrigatório." }, { status: 400 });
  const ctx = await requireAttendantForDoctor(doctorId);
  if (!ctx) return NextResponse.json({ error: "Sem acesso a este médico." }, { status: 403 });
  if (!hasPerm(ctx.link, "agenda")) return NextResponse.json({ error: "Sem permissão para ver a agenda." }, { status: 403 });

  const db = await readDb();
  const bookings = db.bookings
    .filter((b) => b.doctorId === doctorId)
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart))
    .map((b) => ({
      id: b.id, patientName: b.patientName, patientPhone: b.patientPhone, patientEmail: b.patientEmail,
      slotStart: b.slotStart, slotEnd: b.slotEnd, status: b.status, stage: b.stage ?? null,
      modality: b.modality ?? null, locationName: b.locationName ?? null, meetingRoomId: b.meetingRoomId,
    }));
  return NextResponse.json({ bookings, permissions: ctx.link.permissions });
}
