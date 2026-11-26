import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { FIRST_VISIT_STUDY_ID } from "@/lib/first-visit";
import { ETHICS_STATUSES } from "@/lib/research-governance";
import { exportGate, getProtocol, listConsents, upsertProtocol } from "@/lib/research-governance-store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const protocol = await getProtocol(FIRST_VISIT_STUDY_ID, doctorId);
  const consents = await listConsents(FIRST_VISIT_STUDY_ID, doctorId);
  const gate = await exportGate(FIRST_VISIT_STUDY_ID, doctorId, "coorte_retro");
  return NextResponse.json({ protocol, consents, export: gate });
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ethicsStatus = ETHICS_STATUSES.includes(body.ethicsStatus) ? body.ethicsStatus : "none";
  const protocol = await upsertProtocol({
    studyId: FIRST_VISIT_STUDY_ID,
    doctorId,
    clinicId: typeof body.clinicId === "string" ? body.clinicId : null,
    ethicsStatus,
    protocolCode: body.protocolCode ?? null,
    ethicsBody: body.ethicsBody ?? null,
    waiverReason: body.waiverReason ?? null,
    notes: body.notes ?? null,
  });
  const consents = await listConsents(FIRST_VISIT_STUDY_ID, doctorId);
  const gate = await exportGate(FIRST_VISIT_STUDY_ID, doctorId, "coorte_retro");
  return NextResponse.json({ protocol, consents, export: gate });
}
