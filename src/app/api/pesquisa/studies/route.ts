import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { listStudies, createStudy, type StudyType, type StudyStatus } from "@/lib/research-studies-store";
import type { Filter } from "@/lib/research";

const TYPES: StudyType[] = [
  "relato_caso", "serie_casos", "transversal", "coorte_retro", "coorte_prosp", "caso_controle",
  "observacional", "revisao_narrativa", "revisao_integrativa", "revisao_sistematica", "metanalise", "projeto_livre",
];

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const studies = await listStudies(doctorId);
  return NextResponse.json({ studies });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const type = TYPES.includes(body.type) ? (body.type as StudyType) : "projeto_livre";
  const title = String(body.title || "").trim();
  const question = String(body.question || "").trim();
  if (!title && !question) return NextResponse.json({ error: "Informe um título ou uma pergunta." }, { status: 400 });
  const filters: Filter[] = Array.isArray(body.filters) ? body.filters : [];
  const variables: string[] = Array.isArray(body.variables) ? body.variables.map(String) : [];
  const status: StudyStatus = "rascunho";
  const study = await createStudy({
    doctorId,
    type,
    title: title || question.slice(0, 80),
    question,
    filters,
    variables,
    journal: body.journal ? String(body.journal) : null,
    status,
  });
  return NextResponse.json({ study }, { status: 201 });
}
