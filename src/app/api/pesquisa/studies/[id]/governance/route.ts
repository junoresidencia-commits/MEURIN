import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getStudy } from "@/lib/research-studies-store";
import { ETHICS_STATUSES } from "@/lib/research-governance";
import { exportGate, getProtocol, listConsents, upsertProtocol } from "@/lib/research-governance-store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const study = await getStudy(doctorId, id);
  if (!study) return NextResponse.json({ error: "Estudo não encontrado." }, { status: 404 });
  const protocol = await getProtocol(id, doctorId);
  const consents = await listConsents(id, doctorId);
  const gate = await exportGate(id, doctorId, study.type);
  return NextResponse.json({ protocol, consents, export: gate });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const study = await getStudy(doctorId, id);
  if (!study) return NextResponse.json({ error: "Estudo não encontrado." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const ethicsStatus = ETHICS_STATUSES.includes(body.ethicsStatus) ? body.ethicsStatus : "none";
  const protocol = await upsertProtocol({
    studyId: id,
    doctorId,
    clinicId: typeof body.clinicId === "string" ? body.clinicId : null,
    ethicsStatus,
    protocolCode: body.protocolCode ?? null,
    ethicsBody: body.ethicsBody ?? null,
    waiverReason: body.waiverReason ?? null,
    notes: body.notes ?? null,
  });
  const consents = await listConsents(id, doctorId);
  const gate = await exportGate(id, doctorId, study.type);
  return NextResponse.json({ protocol, consents, export: gate });
}
