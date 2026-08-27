import { NextRequest, NextResponse } from "next/server";
import { resolvePdWriteAccess, isPdClinicalPatient } from "@/lib/pd-access";
import { getPdBundle, upsertPdProfile } from "@/lib/pd-store";
import { computePdAlerts } from "@/lib/pd-alerts";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ patientKey: string }> }) {
  const { patientKey } = await params;
  const access = await resolvePdWriteAccess(patientKey);
  if (!access) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const isPd = await isPdClinicalPatient(access.key);
  if (!isPd) return NextResponse.json({ isPd: false, alerts: [], profile: null, prescriptions: [], logs: [], catheter: [], peritonitis: [], adequacy: [], training: [] });
  const bundle = await getPdBundle(access.key);
  return NextResponse.json({ isPd: true, ...bundle, alerts: computePdAlerts(bundle.logs, bundle.catheter) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ patientKey: string }> }) {
  const { patientKey } = await params;
  const access = await resolvePdWriteAccess(patientKey);
  if (!access) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  if (!(await isPdClinicalPatient(access.key))) {
    return NextResponse.json({ error: "Paciente não está em diálise peritoneal." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const profile = await upsertPdProfile(access.key, {
    modality: body.modality === "APD" ? "APD" : "CAPD",
    startDate: body.startDate ? String(body.startDate) : null,
    implantDate: body.implantDate || body.catheterImplantDate ? String(body.implantDate || body.catheterImplantDate) : null,
    catheterType: body.catheterType ? String(body.catheterType) : null,
    catheterSite: body.catheterSite ? String(body.catheterSite) : null,
    caregiver: body.caregiver ? String(body.caregiver) : null,
    center: body.center ? String(body.center) : null,
  }, access.actorId);
  return NextResponse.json({ ok: true, profile });
}
