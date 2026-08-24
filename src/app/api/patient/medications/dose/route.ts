import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getMedication, setAdherence } from "@/lib/medications-store";
import { todayStr } from "@/lib/medications-adherence";

export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  const medicationId = String(b.medicationId || "");
  const time = String(b.time || "").trim();
  const status = b.status === "missed" ? "missed" : b.status === "taken" ? "taken" : null;
  if (!medicationId || !/^\d{2}:\d{2}$/.test(time) || !status) {
    return NextResponse.json({ error: "Dados da dose inválidos." }, { status: 400 });
  }
  const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : todayStr();

  // Segurança: a dose precisa pertencer a um medicamento deste paciente.
  const med = await getMedication(medicationId);
  if (!med || med.patientKey !== email) {
    return NextResponse.json({ error: "Medicamento não encontrado." }, { status: 404 });
  }

  const reason = status === "missed" && b.reason ? String(b.reason) : null;
  const reasonText = status === "missed" && b.reasonText ? String(b.reasonText).slice(0, 300) : null;

  const log = await setAdherence({ medicationId, patientKey: email, date, time, status, reason, reasonText });
  return NextResponse.json({ ok: true, log });
}
