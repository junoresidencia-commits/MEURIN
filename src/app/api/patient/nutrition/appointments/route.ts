import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getAppointment, listAppointmentsForPatient, updateAppointment } from "@/lib/nutrition-appointments-store";
import {
  hasPaidNutritionConsult,
  requestNutritionAppointment,
  resolvePatientNutritionContext,
} from "@/lib/nutrition-plan-access";

export async function GET() {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const [{ nutritionist, contact }, appointments] = await Promise.all([
    resolvePatientNutritionContext(email),
    listAppointmentsForPatient(email),
  ]);
  const paid = await hasPaidNutritionConsult(email, nutritionist?.id);
  return NextResponse.json({
    appointments,
    nutritionist: contact,
    paid,
  });
}

export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b.action === "request" || (b.modality && !b.proofUrl && !b.id)) {
    const modality = b.modality === "presencial" ? "presencial" : "teleconsulta";
    const slotStart = b.slotStart ? String(b.slotStart) : null;
    const result = await requestNutritionAppointment({
      patientKey: email,
      modality,
      slotStart,
      isReturn: b.isReturn === true,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(
      { ok: true, appointment: result.appointment, created: result.created, nutritionist: result.nutritionist },
      { status: result.created ? 201 : 200 }
    );
  }

  const id = String(b.id || "");
  const proof = typeof b.proofUrl === "string" && b.proofUrl.startsWith("data:") && b.proofUrl.length < 1500000 ? b.proofUrl : "";
  if (!id || !proof) return NextResponse.json({ error: "Envie o comprovante (imagem)." }, { status: 400 });
  const appt = await getAppointment(id);
  if (!appt || appt.patientKey !== email) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  const updated = await updateAppointment(id, { proofUrl: proof, status: "aguardando_confirmacao" });
  return NextResponse.json({ ok: true, appointment: updated });
}
