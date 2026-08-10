import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDocumentById, setDocumentAvailability } from "@/lib/patient-store";
import { sendNotification, patientKey } from "@/lib/notify";

/** Médico disponibiliza (ou remove) o documento na área do paciente. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const doc = await getDocumentById(id);
  if (!doc || doc.doctorId !== doctorId) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const available = body.available !== false; // default true
  const updated = await setDocumentAvailability(id, available, doc.doctorName);

  if (available && doc.patientEmail) {
    // Notificação discreta (sem conteúdo clínico).
    await sendNotification({
      userId: patientKey(doc.patientEmail),
      role: "paciente",
      type: "novo_documento",
      title: "Novo documento disponível",
      body: `${doc.doctorName} disponibilizou um novo documento para você.`,
      targetUrl: "/paciente/documentos",
      tag: `doc-${doc.id}`,
      relatedType: "document",
      relatedId: doc.id,
    });
  }
  return NextResponse.json({ ok: true, document: updated });
}
