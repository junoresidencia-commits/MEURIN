import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "Informe o e-mail." }, { status: 400 });
  }

  const db = await readDb();
  const bookings = db.bookings
    .filter((b) => b.patientEmail === email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((b) => {
      const doctor = db.doctors.find((d) => d.id === b.doctorId);
      // WhatsApp para "falar com o médico" só quando o médico disponibiliza.
      const doctorWhatsapp = doctor?.useWhatsappNotifications ? doctor?.notifyWhatsapp || null : null;
      return {
        id: b.id,
        status: b.status,
        stage: b.stage ?? null,
        slotStart: b.slotStart,
        slotEnd: b.slotEnd,
        doctorName: doctor?.name || "Médico",
        doctorWhatsapp,
        meetingRoomId: b.meetingRoomId,
        patientName: b.patientName,
        patientCity: b.patientCity,
        proposedSlotStart: b.proposedSlotStart ?? null,
        proposedSlotEnd: b.proposedSlotEnd ?? null,
        proposalMessage: b.proposalMessage ?? null,
        events: b.events ?? [],
      };
    });

  return NextResponse.json({ bookings });
}
