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
      return {
        id: b.id,
        status: b.status,
        slotStart: b.slotStart,
        doctorName: doctor?.name || "Médico",
        meetingRoomId: b.meetingRoomId,
        patientName: b.patientName,
        patientCity: b.patientCity,
      };
    });

  return NextResponse.json({ bookings });
}
