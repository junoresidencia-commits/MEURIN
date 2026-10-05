import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { EXAM_PROXY_MAX_BYTES, inspectExamFile } from "@/lib/patient-exam-file";
import { addUpload, listUploads, storageAvailable, uploadExamFile } from "@/lib/uploads-store";

export const maxDuration = 60;

export async function GET() {
  const email = await getPatientEmail();
  if (!email) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }
  const uploads = await listUploads(email);
  return NextResponse.json({ uploads });
}

/** Reserva: arquivos pequenos (dev/local). O envio principal vai direto ao Storage via /sign. */
export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }
  if (!storageAvailable()) {
    return NextResponse.json({ error: "Envio indisponível neste ambiente." }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione um arquivo." }, { status: 400 });
  }
  const inspected = inspectExamFile({ name: file.name, type: file.type, size: file.size });
  if (!inspected.ok) {
    return NextResponse.json({ error: inspected.error }, { status: 400 });
  }
  if (file.size > EXAM_PROXY_MAX_BYTES) {
    return NextResponse.json(
      { error: "Este arquivo é grande demais para este caminho. Recarregue a página e envie de novo." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const category = String(form.get("category") || "Exame");
  const examDate = form.get("examDate") ? String(form.get("examDate")) : null;

  try {
    const filePath = await uploadExamFile(email, { name: file.name, type: inspected.mime, buffer });
    const upload = await addUpload({
      patientEmail: email,
      uploader: "patient",
      name: file.name,
      category,
      filePath,
      mime: inspected.mime,
      sizeBytes: file.size,
      examDate,
    });
    return NextResponse.json({ ok: true, upload }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha no envio." },
      { status: 500 }
    );
  }
}
