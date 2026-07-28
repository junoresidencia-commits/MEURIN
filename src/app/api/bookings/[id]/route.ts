import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = await readDb();
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  const doctor = db.doctors.find((d) => d.id === booking.doctorId);
  return NextResponse.json({
    booking,
    doctor: doctor
      ? {
          id: doctor.id,
          name: doctor.name,
          crm: doctor.crm,
          specialty: doctor.specialty,
        }
      : null,
  });
}
