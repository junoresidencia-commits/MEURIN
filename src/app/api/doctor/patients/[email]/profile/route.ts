import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getProfile, replaceProfileData, applyProfileChanges } from "@/lib/clinical-profile-store";

export async function GET(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const profile = await getProfile(access.key);
  return NextResponse.json({
    profile: profile?.data ?? {},
    meta: profile?.meta ?? {},
    history: profile?.history ?? [],
    updatedAt: profile?.updatedAt ?? null,
  });
}

// Edição manual (substitui os campos e registra proveniência "manual" + histórico)
export async function PUT(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  let body: { data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const data = (body.data && typeof body.data === "object" ? body.data : {}) as Record<string, unknown>;
  const saved = await replaceProfileData(access.key, doctorId || null, doctorId || null, data, "manual");
  return NextResponse.json({ ok: true, profile: saved.data, meta: saved.meta, history: saved.history });
}

// Aplica alterações confirmadas a partir da evolução/PDF (proveniência informada)
export async function POST(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  let body: { changes?: Record<string, unknown>; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const changes = body.changes && typeof body.changes === "object" ? body.changes : {};
  const source = body.source === "pdf" ? "pdf" : "evolução";
  const saved = await applyProfileChanges(access.key, doctorId || null, doctorId || null, changes, source);
  return NextResponse.json({ ok: true, profile: saved.data, meta: saved.meta, history: saved.history });
}
