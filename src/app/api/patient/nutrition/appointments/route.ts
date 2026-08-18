import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getAppointment, listAppointmentsForPatient, updateAppointment } from "@/lib/nutrition-appointments-store";

export async function GET() {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const appointments = await listAppointmentsForPatient(email);
  return NextResponse.json({ appointments });
}

// Paciente envia o comprovante do Pix → consulta fica "aguardando confirmação" da nutricionista.
export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const proof = typeof b.proofUrl === "string" && b.proofUrl.startsWith("data:") && b.proofUrl.length < 1500000 ? b.proofUrl : "";
  if (!id || !proof) return NextResponse.json({ error: "Envie o comprovante (imagem)." }, { status: 400 });
  const appt = await getAppointment(id);
  if (!appt || appt.patientKey !== email) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  const updated = await updateAppointment(id, { proofUrl: proof, status: "aguardando_confirmacao" });
  return NextResponse.json({ ok: true, appointment: updated });
}
