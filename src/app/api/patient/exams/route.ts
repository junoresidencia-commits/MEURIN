import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { addUpload, listUploads, storageAvailable, uploadExamFile } from "@/lib/uploads-store";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function GET() {
  const email = await getPatientEmail();
  if (!email) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }
  const uploads = await listUploads(email);
  return NextResponse.json({ uploads });
}

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
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Formato não permitido (use JPG, PNG, WEBP ou PDF)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 15 MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const category = String(form.get("category") || "Exame");
  const examDate = form.get("examDate") ? String(form.get("examDate")) : null;

  try {
    const filePath = await uploadExamFile(email, { name: file.name, type: file.type, buffer });
    const upload = await addUpload({
      patientEmail: email,
      uploader: "patient",
      name: file.name,
      category,
      filePath,
      mime: file.type,
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
