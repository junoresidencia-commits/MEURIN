import { getDoctorSessionId } from "@/lib/auth";
import { getDocumentById } from "@/lib/patient-store";
import { jsonUtf8 } from "@/lib/json-utf8";
import {
  attachSignedPdf,
  parseSignedPdfUpload,
  requireProviderId,
} from "@/lib/digital-signature/attach-signed";
import { fileToSignedPdfBuffer } from "@/lib/digital-signature/file-to-pdf";
import { completeSession, getOpenSession } from "@/lib/document-workflow/sessions";
import { logDocumentEvent } from "@/lib/document-workflow/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Anexa o PDF já assinado (VIDaaS / CFM) como nova versão. O original permanece. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);

  const { id } = await ctx.params;
  const original = await getDocumentById(id);
  if (!original || original.doctorId !== doctorId) {
    return jsonUtf8({ error: "Documento não encontrado." }, 404);
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const uploaded = file instanceof File ? file : null;
    if (!uploaded) return jsonUtf8({ error: "Envie o PDF já assinado." }, 400);
    const converted = await fileToSignedPdfBuffer(uploaded);
    if (converted.error) return jsonUtf8({ error: converted.error }, 400);
    const bad = parseSignedPdfUpload(
      new File([new Uint8Array(converted.buffer)], uploaded.name.replace(/\.[^.]+$/, ".pdf"), { type: "application/pdf" }),
      converted.buffer.length,
    );
    if (bad) return jsonUtf8({ error: bad }, 400);

    const rawProvider = String(form.get("provider") || "vidaas");
    const method = String(form.get("method") || "") === "manual" ? "imagem" : "certificada";
    const providerId = method === "imagem" ? "manual" : requireProviderId(rawProvider);
    const result = await attachSignedPdf({
      doctorId,
      providerId,
      buffer: converted.buffer,
      filename: uploaded.name.replace(/\.[^.]+$/, ".pdf"),
      original,
      signatureMethod: method,
    });

    const open = await getOpenSession({
      documentId: original.id,
      doctorId,
      method: method === "imagem" ? "MANUAL" : "DIGITAL",
    }).catch(() => null);
    if (open) await completeSession(open.id, { status: "completed" }).catch(() => null);
    await logDocumentEvent({
      event: method === "imagem" ? "MANUAL_SIGNED_DOCUMENT_UPLOADED" : "DIGITAL_SIGNATURE_COMPLETED",
      doctorId,
      patientKey: original.patientEmail,
      documentId: result.signed.id,
      detail: `original:${original.id}`,
    });

    return jsonUtf8(
      {
        ok: true,
        id: result.signed.id,
        pdfUrl: `/api/documents/${result.signed.id}/pdf`,
        originalId: original.id,
        status: method === "imagem" ? "Assinatura manual registrada" : "Assinado digitalmente",
        provider: providerId,
        signedAt: result.signed.signedAt,
        signedBy: result.signed.signedBy,
        doctorCrm: result.signed.doctorCrm,
      },
      201
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível guardar o PDF assinado.";
    const status = /não autenticado|sem acesso/i.test(message) ? 403 : /não encontrado/i.test(message) ? 404 : 400;
    return jsonUtf8({ error: message }, status);
  }
}
