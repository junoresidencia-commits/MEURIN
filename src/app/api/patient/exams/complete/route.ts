import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { examPathBelongsToPatient, inspectExamFile } from "@/lib/patient-exam-file";
import { addUpload, examObjectExists, storageAvailable } from "@/lib/uploads-store";

export const maxDuration = 60;

export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }
  if (!storageAvailable()) {
    return NextResponse.json({ error: "Envio indisponível neste ambiente." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const filePath = String(body.path || "");
  const name = String(body.name || "arquivo");
  const inspected = inspectExamFile({
    name,
    type: body.mime ? String(body.mime) : "",
    size: Number(body.size || 0),
  });
  if (!inspected.ok) {
    return NextResponse.json({ error: inspected.error }, { status: 400 });
  }
  if (!examPathBelongsToPatient(filePath, email)) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }
  if (!(await examObjectExists(filePath))) {
    return NextResponse.json({ error: "O arquivo não chegou. Tente enviar de novo." }, { status: 400 });
  }

  try {
    const upload = await addUpload({
      patientEmail: email,
      uploader: "patient",
      name,
      category: String(body.category || "Exame"),
      filePath,
      mime: inspected.mime,
      sizeBytes: Number(body.size || 0),
      examDate: body.examDate ? String(body.examDate) : null,
    });
    return NextResponse.json({ ok: true, upload }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha no envio." },
      { status: 500 }
    );
  }
}
