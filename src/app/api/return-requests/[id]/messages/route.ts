import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getDoctorSessionId } from "@/lib/auth";
import { getAlliedSessionId } from "@/lib/allied-session";
import { getNutritionistId } from "@/lib/nutrition-session";
import { getAttendantId } from "@/lib/attendant-session";
import { getReturnRequest, addReturnMessage, listReturnMessages, updateReturnRequest } from "@/lib/return-request-store";
import { addReturnEvent } from "@/lib/return-request-store";
import { uploadExamFile, storageAvailable } from "@/lib/uploads-store";

const MAX_ATTACH_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

function inspectAttachment(file: File): { ok: true; mime: string } | { ok: false; error: string } {
  if (file.size > MAX_ATTACH_BYTES) return { ok: false, error: "Arquivo muito grande (máx. 15 MB)." };
  const name = file.name.toLowerCase();
  let mime = file.type || "";
  if (!mime || mime === "application/octet-stream") {
    if (name.endsWith(".pdf")) mime = "application/pdf";
    else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) mime = "image/jpeg";
    else if (name.endsWith(".png")) mime = "image/png";
    else if (name.endsWith(".webp")) mime = "image/webp";
    else if (name.endsWith(".heic")) mime = "image/heic";
    else if (name.endsWith(".heif")) mime = "image/heif";
  }
  if (!ALLOWED_MIME.includes(mime)) return { ok: false, error: "Anexe PDF, JPG, PNG, WEBP ou HEIC." };
  return { ok: true, mime };
}

async function who(req: NonNullable<Awaited<ReturnType<typeof getReturnRequest>>>) {
  const email = await getPatientEmail();
  if (email && (req.patientKey.toLowerCase() === email.toLowerCase() || (req.patientEmail || "").toLowerCase() === email.toLowerCase())) {
    return { role: "patient" as const, id: req.patientKey, name: req.patientName };
  }
  const doctorId = await getDoctorSessionId();
  if (doctorId && req.professionalId === doctorId) return { role: "professional" as const, id: doctorId, name: req.professionalName };
  const alliedId = await getAlliedSessionId();
  if (alliedId && req.professionalId === alliedId) return { role: "professional" as const, id: alliedId, name: req.professionalName };
  const nutId = await getNutritionistId();
  if (nutId && req.professionalId === nutId) return { role: "professional" as const, id: nutId, name: req.professionalName };
  const attId = await getAttendantId();
  if (attId && req.attendantInvited) return { role: "attendant" as const, id: attId, name: "Atendente" };
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getReturnRequest(id);
  if (!row) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  if (!(await who(row))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  return NextResponse.json({ messages: await listReturnMessages(id), chatOpen: row.chatOpen, status: row.status });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getReturnRequest(id);
  if (!row) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  const actor = await who(row);
  if (!actor) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!row.chatOpen) return NextResponse.json({ error: "Este chat foi arquivado. Abra um novo atendimento." }, { status: 400 });

  const ctype = req.headers.get("content-type") || "";
  let body = "";
  let attachmentName: string | null = null;
  let attachmentPath: string | null = null;
  let attachmentMime: string | null = null;
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    body = String(form.get("body") || "");
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      const inspected = inspectAttachment(file);
      if (!inspected.ok) return NextResponse.json({ error: inspected.error }, { status: 400 });
      if (!storageAvailable()) return NextResponse.json({ error: "Anexo indisponível neste ambiente." }, { status: 503 });
      const buf = Buffer.from(await file.arrayBuffer());
      attachmentPath = await uploadExamFile(row.patientEmail || row.patientKey, { name: file.name, type: inspected.mime, buffer: buf });
      attachmentName = file.name;
      attachmentMime = inspected.mime;
    }
  } else {
    const json = await req.json().catch(() => ({}));
    body = String(json.body || "");
  }
  if (!body.trim() && !attachmentPath) {
    return NextResponse.json({ error: "Escreva uma mensagem ou anexe um documento." }, { status: 400 });
  }
  const msg = await addReturnMessage({
    requestId: id,
    authorRole: actor.role,
    authorId: actor.id,
    authorName: actor.name,
    body: body.trim(),
    attachmentName,
    attachmentPath,
    attachmentMime,
  });
  if (actor.role === "patient" && row.status === "awaiting_patient") {
    await updateReturnRequest(id, { status: "pending_review" });
    await addReturnEvent(id, "paciente", "respondeu", "Paciente respondeu no chat. Aguardando decisão do profissional.");
  }
  return NextResponse.json({ ok: true, message: msg }, { status: 201 });
}
