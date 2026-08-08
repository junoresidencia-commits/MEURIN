import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getProfile, saveProfile } from "@/lib/clinical-profile-store";

export async function GET(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const profile = await getProfile(access.key);
  return NextResponse.json({ profile: profile?.data ?? {}, updatedAt: profile?.updatedAt ?? null });
}

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

  // Remove valores "desconhecido"/vazios para não gravar "não" implícito.
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === "" || v === null || v === undefined || v === "desconhecido") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    clean[k] = v;
  }

  const saved = await saveProfile({ patientKey: access.key, doctorId: doctorId || null, data: clean, updatedBy: doctorId || null });
  return NextResponse.json({ ok: true, profile: saved.data, updatedAt: saved.updatedAt });
}
