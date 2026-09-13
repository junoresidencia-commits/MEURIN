import { NextResponse } from "next/server";
import { getBookingByRoomId, getDoctorById } from "@/lib/store";

export async function GET(
  _req: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await context.params;
  const booking = await getBookingByRoomId(roomId);
  if (!booking) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  // A sala abre só após o médico CONFIRMAR (pagamento sozinho não libera).
  if (!["confirmed", "completed"].includes(booking.status)) {
    const msg =
      booking.status === "paid"
        ? "Pagamento recebido. A sala abre quando o médico confirmar a consulta."
        : "Consulta liberada somente após o pagamento e a confirmação do médico.";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
  const doctor = await getDoctorById(booking.doctorId);
  return NextResponse.json({
    booking: {
      id: booking.id,
      patientName: booking.patientName,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
      status: booking.status,
      meetingRoomId: booking.meetingRoomId,
    },
    doctor: doctor
      ? { id: doctor.id, name: doctor.name, crm: doctor.crm }
      : null,
  });
}
