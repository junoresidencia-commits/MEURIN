import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { FIRST_VISIT_STUDY_ID } from "@/lib/first-visit";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { CONSENT_STATUSES } from "@/lib/research-governance";
import { listConsents, upsertConsent } from "@/lib/research-governance-store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const consents = await listConsents(FIRST_VISIT_STUDY_ID, doctorId);
  return NextResponse.json({ consents });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const patientKey = String(body.patientKey || body.patient || "").trim();
  const status = CONSENT_STATUSES.includes(body.status) ? body.status : "given";
  if (!patientKey) return NextResponse.json({ error: "Informe o paciente." }, { status: 400 });
  const access = await resolvePatientAccess(patientKey);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) {
    return NextResponse.json({ error: "Você não tem acesso a este paciente. Consentimento só no seu prontuário." }, { status: 403 });
  }
  const consent = await upsertConsent({
    studyId: FIRST_VISIT_STUDY_ID,
    doctorId,
    patientKey: access.key,
    patientName: access.name,
    status,
  });
  return NextResponse.json({ consent });
}
