import { NextResponse } from "next/server";
import { getBookingById, getDoctorById } from "@/lib/store";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const booking = await getBookingById(id);
  if (!booking) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  const doctor = await getDoctorById(booking.doctorId);
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
