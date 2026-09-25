import { getDoctorSessionId } from "@/lib/auth";
import { getDocumentById } from "@/lib/patient-store";
import { jsonUtf8 } from "@/lib/json-utf8";
import {
  attachSignedPdf,
  parseSignedPdfUpload,
  requireProviderId,
} from "@/lib/digital-signature/attach-signed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Importa um PDF assinado (LME / avulso / CEAF) para o prontuário, sem alterar o original. */
export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);

  try {
    const form = await req.formData();
    const file = form.get("file");
    const uploaded = file instanceof File ? file : null;
    const size = uploaded?.size ?? 0;
    const bad = parseSignedPdfUpload(uploaded, size);
    if (bad || !uploaded) return jsonUtf8({ error: bad || "Envie o PDF já assinado." }, 400);

    const rawProvider = String(form.get("provider") || "vidaas");
    const method = String(form.get("method") || "") === "manual" ? "imagem" : "certificada";
    const providerId = method === "imagem" ? "manual" : requireProviderId(rawProvider);
    const originalId = String(form.get("originalDocumentId") || "").trim();
    const original = originalId ? await getDocumentById(originalId) : null;
    if (originalId && (!original || original.doctorId !== doctorId)) {
      return jsonUtf8({ error: "Documento original não encontrado." }, 404);
    }

    const buffer = Buffer.from(await uploaded.arrayBuffer());
    const result = await attachSignedPdf({
      doctorId,
      providerId,
      buffer,
      filename: uploaded.name,
      original,
      patientKey: String(form.get("patientKey") || "").trim() || undefined,
      type: String(form.get("type") || "").trim() || undefined,
      title: String(form.get("title") || "").trim() || undefined,
      signatureMethod: method,
    });

    return jsonUtf8(
      {
        ok: true,
        id: result.signed.id,
        pdfUrl: `/api/documents/${result.signed.id}/pdf`,
        originalId: original?.id ?? null,
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
