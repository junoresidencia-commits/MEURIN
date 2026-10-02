import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { addClinicalNote } from "@/lib/patient-store";

/**
 * Salva uma evolução direto da sala da consulta. Só o médico DONO da consulta
 * (autenticado) pode gravar — o e-mail do paciente não é exposto na sala pública.
 */
export async function POST(req: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ error: "Entre como médico para registrar a evolução." }, { status: 401 });
  }

  const db = await readDb();
  const booking = db.bookings.find((b) => b.meetingRoomId === roomId);
  if (!booking) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  if (booking.doctorId !== doctorId) {
    return NextResponse.json({ error: "Você não atende esta consulta." }, { status: 403 });
  }
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const chiefComplaint = String(body.chiefComplaint || "").trim();
  const history = String(body.history || "").trim();
  const assessment = String(body.assessment || "").trim();
  const plan = String(body.plan || "").trim();
  if (!chiefComplaint && !history && !assessment && !plan) {
    return NextResponse.json({ error: "Escreva ao menos um campo da evolução." }, { status: 400 });
  }

  try {
    const note = await addClinicalNote({
      patientEmail: booking.patientEmail, // chave clínica do paciente do agendamento
      doctorId: doctor.id,
      doctorName: doctor.name,
      chiefComplaint: chiefComplaint || null,
      history: history || null,
      assessment: assessment || null,
      plan: plan || null,
      sharedWithPatient: Boolean(body.sharedWithPatient),
    });
    return NextResponse.json({ ok: true, note }, { status: 201 });
  } catch (error) {
    console.error("Erro ao salvar evolução na sala:", error);
    return NextResponse.json({ error: "Não foi possível salvar a evolução agora. Tente novamente." }, { status: 500 });
  }
}
