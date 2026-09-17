import { getDoctorSessionId } from "@/lib/auth";
import { getDocumentById } from "@/lib/patient-store";
import { jsonUtf8 } from "@/lib/json-utf8";
import { getOpenSession, makeIdempotencyKey, upsertSession } from "@/lib/document-workflow/sessions";
import { logDocumentEvent } from "@/lib/document-workflow/audit";
import { readFile as readStored, DOCPDF_BUCKET } from "@/lib/doc-storage";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);
  const documentId = new URL(req.url).searchParams.get("document") || "";
  if (!documentId) return jsonUtf8({ error: "Informe o documento." }, 400);
  const session = await getOpenSession({ documentId, doctorId });
  return jsonUtf8({ ok: true, session });
}

/** Cria/recupera sessão de assinatura (idempotente). Não apaga o documento. */
export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);
  let body: { documentId?: string; action?: string; patientKey?: string };
  try {
    body = await req.json();
  } catch {
    return jsonUtf8({ error: "Dados inválidos." }, 400);
  }
  const documentId = String(body.documentId || "").trim();
  const action = String(body.action || "").trim();
  if (action !== "manual_start" && action !== "digital_start") {
    return jsonUtf8({ error: "Informe a ação: manual_start ou digital_start." }, 400);
  }
  if (!documentId) return jsonUtf8({ error: "Informe o documento." }, 400);
  const doc = await getDocumentById(documentId);
  if (!doc || doc.doctorId !== doctorId) return jsonUtf8({ error: "Documento não encontrado." }, 404);

  let originalHash: string | null = null;
  if (doc.pdfPath) {
    const file = await readStored(DOCPDF_BUCKET, doc.pdfStorage || "local", doc.pdfPath);
    if (file?.buffer) originalHash = createHash("sha256").update(file.buffer).digest("hex");
  }

  const session = await upsertSession({
    documentId,
    patientKey: doc.patientEmail,
    doctorId,
    provider: action === "manual_start" ? "manual" : "vidaas",
    method: action === "manual_start" ? "MANUAL" : "DIGITAL",
    status: action === "manual_start" ? "awaiting_upload" : "started",
    originalHash,
    idempotencyKey: makeIdempotencyKey({
      documentId,
      doctorId,
      method: action === "manual_start" ? "MANUAL" : "DIGITAL",
    }),
  });

  await logDocumentEvent({
    event: action === "manual_start" ? "MANUAL_SIGNATURE_SELECTED" : "SIGNATURE_STARTED",
    doctorId,
    patientKey: doc.patientEmail,
    documentId,
    detail: originalHash ? `sha256 ${originalHash.slice(0, 12)}` : "sem pdf",
  });

  return jsonUtf8({
    ok: true,
    session,
    notice:
      action === "manual_start"
        ? "PDF baixado não está assinado. Anexe a via digitalizada para registrar assinatura manual."
        : "Sessão de assinatura digital iniciada. Autentique no VIDaaS / Assinador gov.br.",
  });
}
