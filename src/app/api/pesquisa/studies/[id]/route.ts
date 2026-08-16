import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getStudy, updateStudy, deleteStudy, type StudyStatus, type StudyType } from "@/lib/research-studies-store";

const STATUSES: StudyStatus[] = ["rascunho", "coleta", "analise", "escrita", "submetido", "concluido"];
const TYPES: StudyType[] = [
  "relato_caso", "serie_casos", "transversal", "coorte_retro", "coorte_prosp", "caso_controle",
  "observacional", "revisao_narrativa", "revisao_integrativa", "revisao_sistematica", "metanalise", "projeto_livre",
];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const study = await getStudy(doctorId, id);
  if (!study) return NextResponse.json({ error: "Estudo não encontrado." }, { status: 404 });
  return NextResponse.json({ study });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = String(body.title);
  if (body.question !== undefined) patch.question = String(body.question);
  if (body.type !== undefined && TYPES.includes(body.type)) patch.type = body.type;
  if (Array.isArray(body.filters)) patch.filters = body.filters;
  if (Array.isArray(body.variables)) patch.variables = body.variables.map(String);
  if (body.journal !== undefined) patch.journal = body.journal ? String(body.journal) : null;
  if (body.status !== undefined && STATUSES.includes(body.status)) patch.status = body.status;
  const study = await updateStudy(doctorId, id, patch);
  if (!study) return NextResponse.json({ error: "Estudo não encontrado." }, { status: 404 });
  return NextResponse.json({ study });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const ok = await deleteStudy(doctorId, id);
  if (!ok) return NextResponse.json({ error: "Estudo não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
