import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { getClinicalNotes, getPatientData } from "@/lib/patient-store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail).toLowerCase().trim();

  const db = await readDb();
  const bookingsWithMe = db.bookings.filter(
    (b) => b.doctorId === doctorId && b.patientEmail.toLowerCase() === email
  );

  // Autorização: o médico só vê o paciente se houver consulta dele com esse médico.
  if (bookingsWithMe.length === 0) {
    return NextResponse.json(
      { error: "Você não tem acesso a este paciente." },
      { status: 403 }
    );
  }

  const latest = bookingsWithMe
    .slice()
    .sort((a, b) => b.slotStart.localeCompare(a.slotStart))[0];

  const { records, food } = await getPatientData(email);
  const notes = await getClinicalNotes(email);

  const bookings = bookingsWithMe
    .sort((a, b) => b.slotStart.localeCompare(a.slotStart))
    .map((b) => ({
      id: b.id,
      status: b.status,
      slotStart: b.slotStart,
      careReason: b.careReason,
      meetingRoomId: b.meetingRoomId,
    }));

  return NextResponse.json({
    patient: {
      email,
      name: latest.patientName,
      city: latest.patientCity,
      phone: latest.patientPhone,
    },
    bookings,
    records,
    food,
    notes,
  });
}
