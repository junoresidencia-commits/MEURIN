import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getPatientEmail } from "@/lib/patient-session";
import { getBookingByRoomId, getDoctorById } from "@/lib/store";
import { clinicalKey, findPatientByClinicalKey } from "@/lib/patients-store";
import type { Booking } from "@/lib/types";

export type RoomRole = "doctor" | "patient" | "guest";

async function resolveRoomRole(booking: Booking): Promise<RoomRole> {
  const doctorId = await getDoctorSessionId();
  if (doctorId && doctorId === booking.doctorId) return "doctor";

  const subject = await getPatientEmail();
  if (subject) {
    const bookingKey = booking.patientEmail.toLowerCase().trim();
    if (subject.toLowerCase() === bookingKey) return "patient";
    const patient = await findPatientByClinicalKey(subject);
    if (patient) {
      const key = clinicalKey(patient);
      if (key === bookingKey || (patient.email && patient.email.toLowerCase() === bookingKey)) {
        return "patient";
      }
    }
  }
  return "guest";
}

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
  const [doctor, you] = await Promise.all([getDoctorById(booking.doctorId), resolveRoomRole(booking)]);
  return NextResponse.json({
    you: { role: you },
    booking: {
      id: booking.id,
      patientName: booking.patientName,
      patientEmail: you === "doctor" ? booking.patientEmail : undefined,
      careReason: booking.careReason,
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
