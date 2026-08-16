import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getCase, upsertCase, type CaseCategory } from "@/lib/research-studies-store";

const CATS: CaseCategory[] = ["relato", "serie", "raro", "discussao", "aula", "artigo", "congresso", "longitudinal", "outro", "pesquisa"];

export async function GET(_req: Request, ctx: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  const { email } = await ctx.params;
  const access = await resolvePatientAccess(email);
  if (!access || !doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const found = await getCase(doctorId, access.key);
  return NextResponse.json({ case: found });
}

export async function PUT(req: Request, ctx: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  const { email } = await ctx.params;
  const access = await resolvePatientAccess(email);
  if (!access || !doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const categories = Array.isArray(body.categories) ? (body.categories as string[]).filter((c): c is CaseCategory => CATS.includes(c as CaseCategory)) : undefined;
  const note = body.note !== undefined ? (body.note ? String(body.note) : null) : undefined;
  const patientName = String(body.patientName || "");

  const updated = await upsertCase(doctorId, access.key, patientName, { categories, note });
  return NextResponse.json({ case: updated });
}
