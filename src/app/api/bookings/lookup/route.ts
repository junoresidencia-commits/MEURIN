import { NextResponse } from "next/server";
import { getDoctorById, listBookingsByPatientEmail } from "@/lib/store";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "Informe o e-mail." }, { status: 400 });
  }

  const found = await listBookingsByPatientEmail(email, 10);
  const bookings = await Promise.all(
    found.map(async (b) => {
      const doctor = await getDoctorById(b.doctorId);
      // Privacidade: o número INTERNO de notificações NUNCA é exposto. Só o número de
      // contato dos pacientes (que pode ser secretária/clínica), e apenas se habilitado.
      const doctorWhatsapp = doctor?.allowPatientContact ? doctor?.patientContactWhatsapp || null : null;
      return {
        id: b.id,
        status: b.status,
        stage: b.stage ?? null,
        slotStart: b.slotStart,
        slotEnd: b.slotEnd,
        modality: b.modality ?? null,
        locationName: b.locationName ?? null,
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
    })
  );

  return NextResponse.json({ bookings });
}
