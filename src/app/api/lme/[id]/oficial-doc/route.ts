import { v4 as uuid } from "uuid";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { getLme } from "@/lib/lme-store";
import { addDocument, findLmeLinkedDocument, updateDocument } from "@/lib/patient-store";
import { DOCPDF_BUCKET, saveFile } from "@/lib/doc-storage";
import { buildOfficialCeafPdf } from "@/lib/ceaf-official-pdf";
import { inferProtocolId, officialTerSlot } from "@/lib/complementary-docs";
import { jsonUtf8 } from "@/lib/json-utf8";
import { todayBr } from "@/lib/pdf-winansi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Gera o TER oficial do protocolo desta LME, salva no prontuário e vincula à LME. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);
  const { id } = await params;
  const lme = await getLme(id);
  if (!lme) return jsonUtf8({ error: "LME não encontrada." }, 404);
  if (lme.doctorId && lme.doctorId !== doctorId) return jsonUtf8({ error: "Sem acesso." }, 403);

  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind || "ter");
  if (kind !== "ter") {
    return jsonUtf8({
      error: "Só é possível gerar o TER oficial. Não há termo de consentimento separado no pacote SESAB deste protocolo.",
    }, 400);
  }

  const protocolId = inferProtocolId({ ...lme, protocolId: lme.protocolId || (body.protocolId ? String(body.protocolId) : null) });
  const slot = officialTerSlot(protocolId);
  if (!protocolId || slot.status !== "available") {
    return jsonUtf8({ error: slot.status === "unavailable" ? slot.reason : "TER oficial indisponível neste protocolo." }, 404);
  }

  const doctor = await getDoctorById(doctorId);
  let bytes: Uint8Array;
  let label: string;
  try {
    const built = await buildOfficialCeafPdf(protocolId, "ter", {
      name: lme.patientName || "",
      doctor: lme.doctorName || doctor?.name || "",
      crm: lme.doctorCrm || doctor?.crm || "",
      date: todayBr(),
      cpf: lme.patientCpf || "",
      birth: "",
    });
    bytes = built.bytes;
    label = built.label;
  } catch (err) {
    console.error("[lme/oficial-doc]", err instanceof Error ? err.message : err);
    return jsonUtf8({ error: "Não foi possível montar o TER oficial. Tente de novo." }, 500);
  }

  let saved;
  try {
    saved = await saveFile(DOCPDF_BUCKET, doctorId, { name: "ter-oficial.pdf", type: "application/pdf", buffer: Buffer.from(bytes) });
  } catch {
    return jsonUtf8({ error: "Não foi possível guardar o TER. Tente de novo." }, 500);
  }

  const now = new Date().toISOString();
  const existing = await findLmeLinkedDocument(lme.patientEmail, id, "ter");
  try {
    if (existing && existing.status !== "signed") {
      const updated = await updateDocument(existing.id, {
        title: label,
        body: `TER oficial — ${label}`,
        pdfPath: saved.path,
        pdfStorage: saved.storage,
        status: "final",
        sourceLmeId: id,
        history: [...(existing.history || []), { at: now, by: doctor?.name || "Médico", action: "atualizado", detail: `TER oficial gerado (LME ${id}).` }],
      });
      return jsonUtf8({ ok: true, id: (updated || existing).id, pdfUrl: `/api/documents/${existing.id}/pdf`, reused: true }, 200);
    }
    const doc = await addDocument({
      patientEmail: lme.patientEmail,
      doctorId,
      doctorName: doctor?.name || lme.doctorName || "",
      doctorCrm: doctor?.crm || lme.doctorCrm || null,
      type: "ter",
      title: label,
      body: `TER oficial — ${label}`,
      sharedWithPatient: false,
      pdfPath: saved.path,
      pdfStorage: saved.storage,
      status: "final",
      version: 1,
      groupId: uuid(),
      sourceLmeId: id,
      history: [{ at: now, by: doctor?.name || "Médico", action: "criado", detail: `TER oficial gerado (LME ${id}).` }],
    });
    return jsonUtf8({ ok: true, id: doc.id, pdfUrl: `/api/documents/${doc.id}/pdf`, reused: false }, 201);
  } catch (err) {
    console.error("[lme/oficial-doc] save", err instanceof Error ? err.message : err);
    return jsonUtf8({ error: "Não foi possível registrar o TER no prontuário." }, 500);
  }
}
