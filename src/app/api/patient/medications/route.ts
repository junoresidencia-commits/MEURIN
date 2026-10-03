import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { clinicalKey, findPatientByClinicalKey, updatePatient } from "@/lib/patients-store";
import { applyProfileChanges, getProfile } from "@/lib/clinical-profile-store";
import { formatMedicationLines } from "@/lib/clinical-summary";

async function resolveKey() {
  const subject = await getPatientEmail();
  if (!subject) return null;
  const patient = await findPatientByClinicalKey(subject);
  const key = patient ? clinicalKey(patient) : subject.toLowerCase().trim();
  return { subject, patient, key };
}

export async function GET() {
  const resolved = await resolveKey();
  if (!resolved) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  const profile = await getProfile(resolved.key);
  const fromProfile = String(profile?.data?.medicamentos_em_uso || "");
  const fromCadastro = String(resolved.patient?.medications || "");
  const text = fromProfile.trim() || fromCadastro.trim();
  return NextResponse.json({
    medications: text,
    lines: formatMedicationLines(text),
  });
}

export async function PUT(req: Request) {
  const resolved = await resolveKey();
  if (!resolved) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });

  let body: { medications?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const medications = String(body.medications || "")
    .split(/\n|;/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  await applyProfileChanges(
    resolved.key,
    resolved.patient?.doctorId || null,
    resolved.key,
    { medicamentos_em_uso: medications },
    "paciente",
    { respectPriority: false }
  );

  if (resolved.patient) {
    await updatePatient(resolved.patient.id, { medications: medications || null });
  }

  return NextResponse.json({ ok: true, medications, lines: formatMedicationLines(medications) });
}
