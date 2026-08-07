import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { createTemplate, deleteTemplate, listTemplatesByDoctor } from "@/lib/templates-store";
import type { TemplateType } from "@/lib/document-templates";

const VALID_TYPES: TemplateType[] = ["receita", "exame", "relatorio", "evolucao"];

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const templates = await listTemplatesByDoctor(doctorId);
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: { type?: unknown; title?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const type = String(body.type || "") as TemplateType;
  const title = String(body.title || "").trim();
  const text = String(body.body || "").trim();
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: "Informe um título para o modelo." }, { status: 400 });
  if (!text) return NextResponse.json({ error: "O modelo está vazio." }, { status: 400 });

  const template = await createTemplate({ doctorId, type, title, body: text });
  return NextResponse.json({ template }, { status: 201 });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const ok = await deleteTemplate(String(body.id || ""), doctorId);
  if (!ok) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
