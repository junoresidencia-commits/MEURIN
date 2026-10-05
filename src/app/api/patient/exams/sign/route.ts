import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { inspectExamFile } from "@/lib/patient-exam-file";
import { createSignedExamUpload, storageAvailable } from "@/lib/uploads-store";

export const maxDuration = 60;

export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const inspected = inspectExamFile({
    name: String(body.name || "arquivo"),
    type: body.type ? String(body.type) : "",
    size: Number(body.size || 0),
  });
  if (!inspected.ok) {
    return NextResponse.json({ error: inspected.error }, { status: 400 });
  }
  if (!storageAvailable()) {
    return NextResponse.json({ error: "Envio indisponível neste ambiente." }, { status: 503 });
  }

  try {
    const signed = await createSignedExamUpload(email, {
      name: String(body.name || "arquivo"),
      mime: inspected.mime,
    });
    return NextResponse.json({ ok: true, mime: inspected.mime, ...signed });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha no envio." },
      { status: 500 }
    );
  }
}
